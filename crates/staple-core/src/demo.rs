//! Demo operation that proves the worker pipeline: byte count plus checksum.

use thiserror::Error;

const CHUNK: usize = 64 * 1024;
const FNV_OFFSET: u32 = 0x811c_9dc5;
const FNV_PRIME: u32 = 0x0100_0193;

/// Errors returned by core operations. Codes are stable and cross the WASM boundary.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
#[non_exhaustive]
pub enum CoreError {
    /// The input had no bytes.
    #[error("input is empty")]
    EmptyInput,
    /// The input is larger than this operation can count.
    #[error("input is too large")]
    TooLarge,
}

impl CoreError {
    /// Stable machine-readable code for this error.
    #[must_use]
    pub fn code(&self) -> &'static str {
        match self {
            Self::EmptyInput => "empty_input",
            Self::TooLarge => "too_large",
        }
    }
}

/// Result of [`demo_checksum`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DemoResult {
    /// Number of input bytes.
    pub byte_count: u32,
    /// FNV-1a 32-bit checksum of the input.
    pub checksum: u32,
}

/// Counts and checksums `input` (FNV-1a 32-bit), calling `progress` with
/// 0 first, then non-decreasing percentages, ending at 100.
///
/// # Errors
///
/// [`CoreError::EmptyInput`] for empty input, [`CoreError::TooLarge`] above `u32::MAX` bytes.
///
/// ```
/// let mut seen = Vec::new();
/// let r = staple_core::demo::demo_checksum(b"a", |p| seen.push(p)).unwrap();
/// assert_eq!((r.byte_count, r.checksum), (1, 0xe40c_292c));
/// assert_eq!(seen.first(), Some(&0));
/// assert_eq!(seen.last(), Some(&100));
/// ```
pub fn demo_checksum(input: &[u8], mut progress: impl FnMut(u8)) -> Result<DemoResult, CoreError> {
    if input.is_empty() {
        return Err(CoreError::EmptyInput);
    }
    let byte_count = u32::try_from(input.len()).map_err(|_| CoreError::TooLarge)?;
    progress(0);
    let mut checksum = FNV_OFFSET;
    let mut done = 0usize;
    for chunk in input.chunks(CHUNK) {
        for &b in chunk {
            checksum = (checksum ^ u32::from(b)).wrapping_mul(FNV_PRIME);
        }
        done += chunk.len();
        // done <= len, so the quotient is <= 100.
        let pct = u8::try_from(done * 100 / input.len()).unwrap_or(100);
        progress(pct);
    }
    Ok(DemoResult {
        byte_count,
        checksum,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_vectors() {
        let r = demo_checksum(b"foobar", |_| {}).unwrap();
        assert_eq!((r.byte_count, r.checksum), (6, 0xbf9c_f968));
    }

    #[test]
    fn empty_input_errors_with_code() {
        let e = demo_checksum(&[], |_| {}).unwrap_err();
        assert_eq!(e, CoreError::EmptyInput);
        assert_eq!(e.code(), "empty_input");
        assert_eq!(CoreError::TooLarge.code(), "too_large");
    }

    #[test]
    fn progress_starts_0_ends_100_non_decreasing() {
        for len in [1, 1000, CHUNK, CHUNK + 1, 1024 * 1024] {
            let mut seen = Vec::new();
            demo_checksum(&vec![7u8; len], |p| seen.push(p)).unwrap();
            assert_eq!(seen.first(), Some(&0), "len {len}");
            assert_eq!(seen.last(), Some(&100), "len {len}");
            assert!(seen.windows(2).all(|w| w[0] <= w[1]), "len {len}");
        }
    }
}
