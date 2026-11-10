//! Staple core library. Free of `wasm-bindgen`; tested natively.

pub mod compress;
pub mod demo;

/// Returns the crate version.
///
/// ```
/// assert_eq!(staple_core::version(), env!("CARGO_PKG_VERSION"));
/// ```
#[must_use]
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_not_empty() {
        assert_ne!(version(), "");
    }
}
