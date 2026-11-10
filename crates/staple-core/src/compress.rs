//! Pure Rust PDF compression spike: re-encode and downscale DCT images, then
//! prune and flate-compress. Starting point for the Compress tool.

use image::{DynamicImage, ExtendedColorType, ImageFormat, imageops::FilterType};
use lopdf::{Document, Object, ObjectId};
use thiserror::Error;

/// Compression settings shared by every engine, so the comparison is fair.
#[derive(Debug, Clone, PartialEq, Eq)] // not Copy: engines take `&Settings`, one shared value
pub struct Settings {
    /// JPEG quality, 1 to 100.
    pub jpeg_quality: u8,
    /// Images placed at more pixels per inch than this are downscaled.
    pub max_dpi: u32,
}

/// The one settings value both spike candidates use (a `static`: one address).
pub static DEFAULT: Settings = Settings {
    jpeg_quality: 75,
    max_dpi: 150,
};

/// Errors from [`compress_pdf`].
#[derive(Debug, Error)]
#[non_exhaustive]
pub enum CompressError {
    /// The input has no `%PDF-` header.
    #[error("input is not a PDF")]
    NotPdf,
    /// The file ends early or points at objects that are missing.
    #[error("PDF is truncated or damaged")]
    Truncated,
    /// The PDF parser rejected the file.
    #[error("cannot parse PDF: {0}")]
    Parse(#[from] lopdf::Error),
    /// An image could not be decoded or encoded.
    #[error("image error: {0}")]
    Image(#[from] image::ImageError),
}

impl CompressError {
    /// Stable machine-readable code for this error.
    #[must_use]
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotPdf => "not_pdf",
            Self::Truncated => "truncated",
            Self::Parse(_) => "parse",
            Self::Image(_) => "image",
        }
    }
}

/// Downscales `img` to at most `max_dpi` when placed `placed_pts_w` points wide
/// (72 points per inch), then encodes it as JPEG. Returns bytes, width, height.
///
/// # Errors
///
/// Encoder failure.
pub fn reencode_jpeg(
    img: &DynamicImage,
    placed_pts_w: u64,
    s: &Settings,
) -> Result<(Vec<u8>, u32, u32), CompressError> {
    let rgb = img.to_rgb8();
    let (w, h) = rgb.dimensions();
    let target_w = u64::from(s.max_dpi) * placed_pts_w / 72;
    // shortcut: 2% slack so a page-filling ~150 DPI image is not shrunk by a pixel; EPIC-05 may drop it
    let rgb = if target_w > 0 && u64::from(w) > target_w + target_w / 50 {
        let nw = u32::try_from(target_w).unwrap_or(w);
        let nh = u32::try_from(u64::from(h) * target_w / u64::from(w))
            .unwrap_or(h)
            .max(1);
        image::imageops::resize(&rgb, nw, nh, FilterType::Triangle)
    } else {
        rgb
    };
    let (w, h) = rgb.dimensions();
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, s.jpeg_quality).encode(
        rgb.as_raw(),
        w,
        h,
        ExtendedColorType::Rgb8,
    )?;
    Ok((out, w, h))
}

/// Object ids of the image `XObject` streams a page references.
fn page_xobjects(doc: &Document, page: ObjectId) -> Vec<ObjectId> {
    let res = doc
        .get_dictionary(page)
        .and_then(|p| p.get(b"Resources"))
        .and_then(|r| doc.dereference(r))
        .and_then(|(_, r)| r.as_dict());
    let xo = res
        .and_then(|r| r.get(b"XObject"))
        .and_then(|x| doc.dereference(x))
        .and_then(|(_, x)| x.as_dict());
    xo.map(|d| {
        d.iter()
            .filter_map(|(_, o)| o.as_reference().ok())
            .collect()
    })
    .unwrap_or_default()
}

/// Checks that every page's content streams and image `XObject` streams resolve.
/// Returns the page count. `load_mem` alone can accept a cut file.
fn walk_pages(doc: &Document) -> Result<usize, CompressError> {
    let pages = doc.get_pages();
    for &page in pages.values() {
        for id in doc.get_page_contents(page) {
            if doc.get_object(id).and_then(Object::as_stream).is_err() {
                return Err(CompressError::Truncated);
            }
        }
        for id in page_xobjects(doc, page) {
            if doc.get_object(id).is_err() {
                return Err(CompressError::Truncated);
            }
        }
    }
    Ok(pages.len())
}

/// Parses `bytes` and returns its page count, after the same page walk as [`compress_pdf`].
///
/// # Errors
///
/// [`CompressError::NotPdf`], [`CompressError::Truncated`] or [`CompressError::Parse`].
pub fn page_count(bytes: &[u8]) -> Result<usize, CompressError> {
    if !bytes.starts_with(b"%PDF-") {
        return Err(CompressError::NotPdf);
    }
    let tail = &bytes[bytes.len().saturating_sub(1024)..];
    let has = |needle: &[u8]| tail.windows(needle.len()).any(|w| w == needle);
    if !has(b"startxref") || !has(b"%%EOF") {
        return Err(CompressError::Truncated);
    }
    walk_pages(&Document::load_mem(bytes)?)
}

fn is_dct(dict: &lopdf::Dictionary) -> bool {
    match dict.get(b"Filter") {
        Ok(Object::Name(n)) => n == b"DCTDecode",
        Ok(Object::Array(a)) => matches!(a.as_slice(), [Object::Name(n)] if n == b"DCTDecode"),
        _ => false,
    }
}

/// Compresses a PDF: re-encodes DCT images with `s`, then prunes and flate-compresses.
///
/// # Errors
///
/// A [`CompressError`]; never panics on bad input.
pub fn compress_pdf(input: &[u8], s: &Settings) -> Result<Vec<u8>, CompressError> {
    page_count(input)?;
    let mut doc = Document::load_mem(input)?;
    let mut jobs: Vec<(ObjectId, u64)> = Vec::new();
    for page in doc.get_pages().into_values() {
        // shortcut: assumes one full-page image, EPIC-05 must read the CTM
        let width = doc
            .get_dictionary(page)
            .and_then(|p| p.get(b"MediaBox"))
            .and_then(Object::as_array)
            .ok()
            .and_then(|a| Some(a.get(2)?.as_float().ok()? - a.first()?.as_float().ok()?))
            .unwrap_or(0.0);
        // Page widths are small positive numbers; the cast only rounds.
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        let pts = width.max(0.0).round() as u64;
        jobs.extend(page_xobjects(&doc, page).into_iter().map(|id| (id, pts)));
    }
    for (id, pts) in jobs {
        let Ok(Object::Stream(st)) = doc.get_object(id) else {
            continue;
        };
        let is_image = st.dict.get(b"Subtype").and_then(Object::as_name).ok() == Some(b"Image");
        if !is_image || !is_dct(&st.dict) {
            continue;
        }
        let img = image::load_from_memory_with_format(&st.content, ImageFormat::Jpeg)?;
        let (bytes, w, h) = reencode_jpeg(&img, pts, s)?;
        if let Ok(Object::Stream(st)) = doc.get_object_mut(id) {
            st.dict.set("Width", i64::from(w));
            st.dict.set("Height", i64::from(h));
            st.set_content(bytes);
        }
    }
    doc.prune_objects();
    doc.compress();
    let mut out = Vec::new();
    doc.save_to(&mut out).map_err(lopdf::Error::from)?;
    page_count(&out)?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_settings() {
        assert_eq!(
            DEFAULT,
            Settings {
                jpeg_quality: 75,
                max_dpi: 150
            }
        );
    }

    #[test]
    fn not_pdf() {
        assert!(matches!(
            compress_pdf(b"not a pdf", &DEFAULT),
            Err(CompressError::NotPdf)
        ));
    }
}
