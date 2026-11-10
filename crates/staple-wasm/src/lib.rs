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
