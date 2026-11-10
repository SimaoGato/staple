#![allow(clippy::unwrap_used)]
use lopdf::{Document, Object};
use staple_bench::{Spec, find_op, generate, run};
use staple_core::compress::{CompressError, DEFAULT, Settings, compress_pdf};

fn small_pdf(spec: &Spec) -> Vec<u8> {
    let d = std::env::temp_dir().join(format!(
        "staple-compress-{}-{:?}",
        std::process::id(),
        std::thread::current().id()
    ));
    let _ = std::fs::remove_dir_all(&d);
    generate(&d, spec).unwrap();
    let b = std::fs::read(d.join("image-heavy-20mb.pdf")).unwrap();
    let _ = std::fs::remove_dir_all(&d);
    b
}

/// Largest image `XObject` `(width, height)` in the PDF.
fn max_image(bytes: &[u8]) -> (i64, i64) {
    let doc = Document::load_mem(bytes).unwrap();
    doc.objects
        .values()
        .filter_map(|o| match o {
            Object::Stream(s)
                if s.dict.get(b"Subtype").and_then(Object::as_name).ok() == Some(b"Image") =>
            {
                Some((
                    s.dict.get(b"Width").unwrap().as_i64().unwrap(),
                    s.dict.get(b"Height").unwrap().as_i64().unwrap(),
                ))
            }
            _ => None,
        })
        .max()
        .unwrap()
}

fn is_image(o: &Object) -> bool {
    matches!(o, Object::Stream(s) if s.dict.get(b"Subtype").and_then(Object::as_name).ok() == Some(b"Image"))
}

/// Applies `f` to the first image stream; returns the new PDF and that image's id.
fn edit_first_image(input: &[u8], f: impl Fn(&mut lopdf::Stream)) -> (Vec<u8>, lopdf::ObjectId) {
    let mut doc = Document::load_mem(input).unwrap();
    let (id, o) = doc.objects.iter_mut().find(|(_, o)| is_image(o)).unwrap();
    if let Object::Stream(st) = o {
        f(st);
    }
    let id = *id;
    let mut out = Vec::new();
    doc.save_to(&mut out).unwrap();
    (out, id)
}

fn image_content(pdf: &[u8], id: lopdf::ObjectId) -> Vec<u8> {
    let doc = Document::load_mem(pdf).unwrap();
    doc.get_object(id)
        .unwrap()
        .as_stream()
        .unwrap()
        .content
        .clone()
}

#[test]
fn non_rgb_image_is_left_untouched() {
    let (input, id) = edit_first_image(&small_pdf(&Spec::small()), |st| {
        st.dict
            .set("ColorSpace", Object::Name(b"DeviceGray".to_vec()));
    });
    let out = compress_pdf(&input, &DEFAULT).unwrap();
    assert_eq!(image_content(&out, id), image_content(&input, id));
}

#[test]
fn image_with_decode_array_is_left_untouched() {
    let (input, id) = edit_first_image(&small_pdf(&Spec::small()), |st| {
        st.dict.set(
            "Decode",
            vec![1.into(), 0.into(), 1.into(), 0.into(), 1.into(), 0.into()],
        );
    });
    let out = compress_pdf(&input, &DEFAULT).unwrap();
    assert_eq!(image_content(&out, id), image_content(&input, id));
}

#[test]
fn undecodable_image_is_skipped_not_fatal() {
    let (input, id) = edit_first_image(&small_pdf(&Spec::small()), |st| {
        st.set_content(b"not a jpeg".to_vec());
    });
    let out = compress_pdf(&input, &DEFAULT).unwrap();
    assert_eq!(image_content(&out, id), b"not a jpeg");
    assert_eq!(Document::load_mem(&out).unwrap().get_pages().len(), 3);
}

#[test]
fn output_is_never_larger_than_input() {
    // q5 source JPEGs grow when re-encoded at q75
    let input = small_pdf(&Spec {
        jpeg_quality: 5,
        image_dims: (400, 500),
        ..Spec::small()
    });
    let out = compress_pdf(&input, &DEFAULT).unwrap();
    assert!(out.len() <= input.len(), "{} > {}", out.len(), input.len());
}

#[test]
fn ops_share_one_settings_value() {
    let seen = std::cell::Cell::new(None);
    let _ = run(
        |_, s: &Settings| {
            seen.set(Some(std::ptr::eq(s, &raw const DEFAULT)));
            Ok(0)
        },
        b"",
    );
    assert_eq!(seen.get(), Some(true));
}

#[test]
fn compress_rust_op_returns_output_size() {
    let input = small_pdf(&Spec::small());
    let n = find_op("compress-rust").unwrap()(&input).unwrap();
    assert!(n > 0);
}

#[test]
fn output_reparses_with_same_pages() {
    let input = small_pdf(&Spec::small());
    let out = compress_pdf(&input, &DEFAULT).unwrap();
    assert_eq!(Document::load_mem(&out).unwrap().get_pages().len(), 3);
    assert_ne!(out.len(), 0);
}

#[test]
fn high_dpi_image_is_downscaled_to_150_dpi() {
    let spec = Spec {
        image_pages: 1,
        image_dims: (2480, 3508),
        ..Spec::small()
    };
    let input = small_pdf(&spec);
    assert_eq!(max_image(&input), (2480, 3508));
    let out = compress_pdf(&input, &DEFAULT).unwrap();
    let (w, h) = max_image(&out);
    assert!(w <= 1240 && h <= 1754, "{w}x{h}");
    assert_eq!(Document::load_mem(&out).unwrap().get_pages().len(), 1);
}

#[test]
fn non_pdf_is_typed_error() {
    assert!(matches!(
        compress_pdf(b"not a pdf", &DEFAULT),
        Err(CompressError::NotPdf)
    ));
}

#[test]
fn half_cut_pdf_is_truncated() {
    let input = small_pdf(&Spec::small());
    let r = compress_pdf(&input[..input.len() / 2], &DEFAULT);
    assert!(matches!(r, Err(CompressError::Truncated)), "{r:?}");
}

#[test]
fn intact_trailer_but_cut_image_stream_is_error() {
    let mut input = small_pdf(&Spec::small());
    let at = input.windows(9).position(|w| w == b"DCTDecode").unwrap() + 200;
    input.drain(at..at + 100); // trailer intact, xref offsets now wrong, image bytes short
    let r = compress_pdf(&input, &DEFAULT);
    assert!(r.is_err(), "{r:?}");
}

/// Run locally: `cargo test -p staple-bench --features pdfium -- --ignored` with a `PDFium` library.
#[cfg(feature = "pdfium")]
mod pdfium {
    use super::*;

    #[test]
    #[ignore = "needs a local PDFium library"]
    fn pdfium_output_reparses_with_same_pages() {
        let out = staple_bench::pdfium::compress(&small_pdf(&Spec::small()), &DEFAULT).unwrap();
        assert_eq!(Document::load_mem(&out).unwrap().get_pages().len(), 3);
    }

    #[test]
    #[ignore = "needs a local PDFium library"]
    fn pdfium_downscales_to_150_dpi() {
        let spec = Spec {
            image_pages: 1,
            image_dims: (2480, 3508),
            ..Spec::small()
        };
        let out = staple_bench::pdfium::compress(&small_pdf(&spec), &DEFAULT).unwrap();
        let (w, h) = max_image(&out);
        assert!(w <= 1240 && h <= 1754, "{w}x{h}");
        assert_eq!(Document::load_mem(&out).unwrap().get_pages().len(), 1);
    }
}
