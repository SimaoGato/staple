//! WebAssembly bindings for `staple-core`.

use wasm_bindgen::prelude::wasm_bindgen;

/// Returns the core crate version.
#[must_use]
#[wasm_bindgen]
pub fn version() -> String {
    staple_core::version().to_owned()
}
