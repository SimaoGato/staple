//! Spike: render PDF pages with `PDFium` inside a Web Worker.
//!
//! The `PDFium` module itself is a separate prebuilt WASM; JS must call
//! `initialize_pdfium_render` (from `pdfium-render`) first. Wasm32 only: native builds are empty.
#![cfg(target_arch = "wasm32")]

use pdfium_render::prelude::{PdfDocument, PdfRenderConfig, Pdfium, PdfiumError};
use std::cell::OnceCell;
use wasm_bindgen::prelude::{JsValue, wasm_bindgen};

/// An open PDF document.
#[wasm_bindgen]
pub struct Doc {
    inner: PdfDocument<'static>,
}

/// A rendered page: RGBA pixels.
#[wasm_bindgen]
pub struct Rendered {
    /// Width in pixels.
    #[wasm_bindgen(readonly)]
    pub width: u32,
    /// Height in pixels.
    #[wasm_bindgen(readonly)]
    pub height: u32,
    rgba: Vec<u8>,
}

#[wasm_bindgen]
impl Rendered {
    /// Takes the RGBA bytes, consuming `self` (no copy of the buffer).
    #[must_use]
    pub fn take_rgba(self) -> Vec<u8> {
        self.rgba
    }
}

thread_local! {
    static PDFIUM: OnceCell<&'static Pdfium> = const { OnceCell::new() };
}

/// Output cap: 64 Mpx is 256 MB of RGBA, well inside wasm32's 4 GB.
const MAX_PIXELS: u64 = 64_000_000;

fn err(e: &PdfiumError) -> JsValue {
    JsValue::from_str(&format!("{e:?}"))
}

#[wasm_bindgen]
impl Doc {
    /// Opens a document. Needs `initialize_pdfium_render` to have run.
    ///
    /// # Errors
    ///
    /// The `PdfiumError` debug text as a JS string.
    #[wasm_bindgen(constructor)]
    pub fn new(bytes: Vec<u8>) -> Result<Doc, JsValue> {
        let pdfium = PDFIUM.with(|cell| {
            if let Some(p) = cell.get() {
                return Ok(*p);
            }
            let bindings = Pdfium::bind_to_system_library().map_err(|e| err(&e))?;
            // Leaked once per worker: PDFium's bindings are process-global anyway.
            let p: &'static Pdfium = Box::leak(Box::new(Pdfium::new(bindings)));
            Ok::<_, JsValue>(*cell.get_or_init(|| p))
        })?;
        let inner = pdfium
            .load_pdf_from_byte_vec(bytes, None)
            .map_err(|e| err(&e))?;
        Ok(Doc { inner })
    }

    /// Page count.
    #[must_use]
    pub fn page_count(&self) -> u32 {
        u32::try_from(self.inner.pages().len()).unwrap_or(0)
    }

    /// Renders page `index` at `dpi`.
    ///
    /// # Errors
    ///
    /// The `PdfiumError` debug text as a JS string.
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    pub fn render(&self, index: u32, dpi: f32) -> Result<Rendered, JsValue> {
        let index = i32::try_from(index).map_err(|_| JsValue::from_str("page index"))?;
        let page = self.inner.pages().get(index).map_err(|e| err(&e))?;
        if !dpi.is_finite() || dpi <= 0.0 {
            return Err(JsValue::from_str("dpi must be finite and positive"));
        }
        // Page size is untrusted: check the output size before PDFium allocates the bitmap.
        let scale = f64::from(dpi) / 72.0;
        let w = (f64::from(page.width().value) * scale).ceil();
        let h = (f64::from(page.height().value) * scale).ceil();
        if !(w.is_finite() && h.is_finite() && w >= 1.0 && h >= 1.0)
            || (w as u64).saturating_mul(h as u64) > MAX_PIXELS
        {
            return Err(JsValue::from_str("page too large to render at this dpi"));
        }
        let config = PdfRenderConfig::new().scale_page_by_factor(dpi / 72.0);
        let bitmap = page.render_with_config(&config).map_err(|e| err(&e))?;
        Ok(Rendered {
            width: bitmap.width() as u32,
            height: bitmap.height() as u32,
            rgba: bitmap.as_rgba_bytes(),
        })
    }
}
