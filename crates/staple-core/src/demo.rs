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

/// `done * 100 / total` in u64: `usize` is 32-bit on wasm32 and would overflow.
fn percent(done: usize, total: usize) -> u8 {
    let p = done as u64 * 100 / (total as u64).max(1);
    u8::try_from(p).unwrap_or(100)
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
        progress(percent(done, input.len()));
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
    fn percent_does_not_overflow_32_bits() {
        let max = u32::MAX as usize;
        assert_eq!(percent(max, max), 100);
        assert_eq!(percent(max / 2, max), 49);
        // 50 MB * 100 exceeds u32::MAX, so a 32-bit multiply would wrap.
        assert_eq!(percent(50_000_000, 100_000_000), 50);
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
