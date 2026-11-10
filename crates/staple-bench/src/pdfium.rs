//! `PDFium` compression candidate (feature `pdfium`). Needs a local PDFium library:
//! `PDFIUM_DYNAMIC_LIB_PATH` (a directory) or `./pdfium/lib`.
//! Route: re-encode each image object as JPEG, put the new object where the old was.

use std::io::Cursor;
use std::sync::OnceLock;

use pdfium_render::prelude::*;
use staple_core::compress::{Settings, reencode_jpeg};

fn pdfium() -> Result<&'static Pdfium, String> {
    static P: OnceLock<Result<Pdfium, String>> = OnceLock::new();
    P.get_or_init(|| {
        let dir =
            std::env::var("PDFIUM_DYNAMIC_LIB_PATH").unwrap_or_else(|_| "./pdfium/lib".into());
        Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(&dir))
            .map(Pdfium::new)
            .map_err(|e| format!("cannot load PDFium from {dir}: {e}"))
    })
    .as_ref()
    .map_err(Clone::clone)
}

/// Compresses `bytes` with `PDFium` and the shared `s`.
///
/// # Errors
///
/// A message for any `PDFium` or encoder failure.
pub fn compress(bytes: &[u8], s: &Settings) -> Result<Vec<u8>, String> {
    let e = |e: PdfiumError| e.to_string();
    let doc = pdfium()?.load_pdf_from_byte_slice(bytes, None).map_err(e)?;
    for index in 0..doc.pages().len() {
        let mut page = doc.pages().get(index).map_err(e)?;
        // Newest objects are appended, so walking down keeps unvisited indices stable.
        for i in (0..page.objects().len()).rev() {
            if page
                .objects()
                .get(i)
                .map_err(e)?
                .as_image_object()
                .is_none()
            {
                continue;
            }
            let old = page.objects_mut().remove_object_at_index(i).map_err(e)?;
            let Some(img) = old.as_image_object() else {
                continue;
            };
            let raw = img.get_raw_image().map_err(e)?;
            // Placed size in points; rounding is all the cast does.
            #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
            let pts = old.width().map_err(e)?.value.max(0.0).round() as u64;
            let (jpeg, _, _) = reencode_jpeg(&raw, pts, s).map_err(|x| x.to_string())?;
            let mut new =
                PdfPageImageObject::new_from_jpeg_reader(&doc, Cursor::new(jpeg)).map_err(e)?;
            new.transform_from(&old).map_err(e)?;
            page.objects_mut().add_image_object(new).map_err(e)?;
        }
    }
    doc.save_to_bytes().map_err(e)
}
