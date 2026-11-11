//! WebAssembly bindings for `staple-core`.

use staple_core::demo;
use wasm_bindgen::prelude::{JsValue, wasm_bindgen};

/// Returns the core crate version.
#[must_use]
#[wasm_bindgen]
pub fn version() -> String {
    staple_core::version().to_owned()
}

/// Result of [`demo`].
#[wasm_bindgen]
pub struct DemoResult {
    /// Number of input bytes.
    #[wasm_bindgen(readonly)]
    pub byte_count: u32,
    /// FNV-1a 32-bit checksum.
    #[wasm_bindgen(readonly)]
    pub checksum: u32,
}

/// Runs the demo operation, calling `on_progress(percent)` as it goes.
/// Errors are thrown as the stable error code string.
///
/// # Errors
///
/// The core error code as a JS string.
#[wasm_bindgen]
pub fn demo(input: &[u8], on_progress: &js_sys::Function) -> Result<DemoResult, JsValue> {
    demo::demo_checksum(input, |p| {
        // A failing callback must not abort the job.
        let _ = on_progress.call1(&JsValue::NULL, &JsValue::from(p));
    })
    .map(|r| DemoResult {
        byte_count: r.byte_count,
        checksum: r.checksum,
    })
    .map_err(|e| JsValue::from_str(e.code()))
}

/// Compresses a PDF with the shared default settings (pure Rust spike).
/// Errors are thrown as the stable error code string.
///
/// # Errors
///
/// The core error code as a JS string.
#[wasm_bindgen]
pub fn compress_pdf(input: &[u8]) -> Result<Vec<u8>, JsValue> {
    staple_core::compress::compress_pdf(input, &staple_core::compress::DEFAULT)
        .map_err(|e| JsValue::from_str(e.code()))
}

/// Zips `datas[i]` (`Uint8Array`) under a de-duplicated `names[i]`, stored without compression.
/// Errors are thrown as the stable error code string.
///
/// # Errors
///
/// The core error code as a JS string; `internal` when the arrays differ in length.
#[wasm_bindgen]
#[allow(clippy::needless_pass_by_value)] // wasm-bindgen cannot take `&[String]`
pub fn zip_files(names: Vec<String>, datas: &js_sys::Array) -> Result<Vec<u8>, JsValue> {
    if names.len() != datas.length() as usize {
        return Err(JsValue::from_str("internal"));
    }
    let names = staple_core::zip::unique_names(&names);
    let bytes: Vec<Vec<u8>> = datas
        .iter()
        .map(|v| js_sys::Uint8Array::new(&v).to_vec())
        .collect();
    let entries: Vec<(&str, &[u8])> = names
        .iter()
        .map(String::as_str)
        .zip(bytes.iter().map(Vec::as_slice))
        .collect();
    staple_core::zip::zip_stored(&entries).map_err(|e| JsValue::from_str(e.code()))
}
