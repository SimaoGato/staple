//! Stored-only ZIP writer and entry-name de-duplication. No ZIP64: see [`ZipError::TooLarge`].

use std::collections::HashSet;

use thiserror::Error;

/// 1980-01-01, the earliest DOS date; keeps output reproducible.
const DOS_DATE: u16 = 0x0021;
/// General purpose flag bit 11: names are UTF-8.
const FLAG_UTF8: u16 = 0x0800;

/// Errors from [`zip_stored`]. Codes are stable and cross the WASM boundary.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
#[non_exhaustive]
pub enum ZipError {
    /// More than 65535 entries, or a size or offset above `u32::MAX` (no ZIP64).
    #[error("archive is too large")]
    TooLarge,
}

impl ZipError {
    /// Stable machine-readable code for this error.
    #[must_use]
    pub fn code(&self) -> &'static str {
        match self {
            Self::TooLarge => "too_large",
        }
    }
}

/// Splits at the last `.` when it is not the first character.
fn split_ext(name: &str) -> (&str, &str) {
    match name.rfind('.') {
        Some(i) if i > 0 => name.split_at(i),
        _ => (name, ""),
    }
}

/// Makes names unique, case-insensitively (Windows and macOS merge `Scan.pdf` and
/// `scan.pdf` on extraction). The first holder of a name keeps it; later duplicates
/// become `name (2).ext`, `name (3).ext`, ... Literal names are reserved up front,
/// so a duplicate never takes a name that another input already has.
///
/// ```
/// let n = |v: &[&str]| v.iter().map(|s| (*s).to_owned()).collect::<Vec<_>>();
/// assert_eq!(
///     staple_core::zip::unique_names(&n(&["scan.pdf", "scan.pdf"])),
///     n(&["scan.pdf", "scan (2).pdf"])
/// );
/// ```
#[must_use]
pub fn unique_names(names: &[String]) -> Vec<String> {
    let mut used = HashSet::new();
    let keeper: Vec<bool> = names
        .iter()
        .map(|n| used.insert(n.to_lowercase()))
        .collect();
    names
        .iter()
        .zip(keeper)
        .map(|(name, keep)| {
            if keep {
                return name.clone();
            }
            let (stem, ext) = split_ext(name);
            // Terminates: only finitely many names are taken.
            let mut k = 2usize;
            loop {
                let c = format!("{stem} ({k}){ext}");
                if used.insert(c.to_lowercase()) {
                    return c;
                }
                k += 1;
            }
        })
        .collect()
}

fn u16_len(n: usize) -> Result<u16, ZipError> {
    u16::try_from(n).map_err(|_| ZipError::TooLarge)
}

fn u32_len(n: usize) -> Result<u32, ZipError> {
    u32::try_from(n).map_err(|_| ZipError::TooLarge)
}

/// Builds a ZIP with every entry stored (method 0) and names flagged UTF-8.
///
/// Names are written verbatim: callers must pass bare file names (no `/`, `\\`, `..`,
/// not empty), or extraction can escape the target folder (zip-slip).
///
/// # Errors
///
/// [`ZipError::TooLarge`] above 65535 entries or `u32::MAX` bytes.
pub fn zip_stored(entries: &[(&str, &[u8])]) -> Result<Vec<u8>, ZipError> {
    let count = u16_len(entries.len())?;
    let mut out: Vec<u8> = Vec::new();
    let mut central: Vec<u8> = Vec::new();
    for (name, data) in entries {
        let offset = u32_len(out.len())?;
        let crc = crc32fast::hash(data);
        let size = u32_len(data.len())?;
        let name_len = u16_len(name.len())?;
        // Local header, then the fields central adds in between.
        let common = |v: &mut Vec<u8>| {
            v.extend_from_slice(&20u16.to_le_bytes()); // version needed
            v.extend_from_slice(&FLAG_UTF8.to_le_bytes());
            v.extend_from_slice(&0u16.to_le_bytes()); // method: stored
            v.extend_from_slice(&0u16.to_le_bytes()); // time
            v.extend_from_slice(&DOS_DATE.to_le_bytes());
            v.extend_from_slice(&crc.to_le_bytes());
            v.extend_from_slice(&size.to_le_bytes()); // compressed
            v.extend_from_slice(&size.to_le_bytes()); // uncompressed
            v.extend_from_slice(&name_len.to_le_bytes());
            v.extend_from_slice(&0u16.to_le_bytes()); // extra len
        };
        out.extend_from_slice(&0x0403_4b50u32.to_le_bytes());
        common(&mut out);
        out.extend_from_slice(name.as_bytes());
        out.extend_from_slice(data);

        central.extend_from_slice(&0x0201_4b50u32.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes()); // version made by
        common(&mut central);
        central.extend_from_slice(&[0; 10]); // comment len, disk start, internal and external attrs
        central.extend_from_slice(&offset.to_le_bytes());
        central.extend_from_slice(name.as_bytes());
    }
    let cd_offset = u32_len(out.len())?;
    let cd_size = u32_len(central.len())?;
    out.extend_from_slice(&central);
    u32_len(out.len())?;
    out.extend_from_slice(&0x0605_4b50u32.to_le_bytes());
    out.extend_from_slice(&[0; 4]); // disk numbers
    out.extend_from_slice(&count.to_le_bytes());
    out.extend_from_slice(&count.to_le_bytes());
    out.extend_from_slice(&cd_size.to_le_bytes());
    out.extend_from_slice(&cd_offset.to_le_bytes());
    out.extend_from_slice(&[0; 2]); // comment len
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn n(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| (*s).to_owned()).collect()
    }

    #[test]
    fn dedups_repeats() {
        assert_eq!(
            unique_names(&n(&["scan.pdf", "scan.pdf", "scan.pdf"])),
            n(&["scan.pdf", "scan (2).pdf", "scan (3).pdf"])
        );
    }

    #[test]
    fn literal_names_are_reserved() {
        assert_eq!(
            unique_names(&n(&["scan.pdf", "scan.pdf", "scan (2).pdf"])),
            n(&["scan.pdf", "scan (3).pdf", "scan (2).pdf"])
        );
    }

    #[test]
    fn folds_case() {
        assert_eq!(
            unique_names(&n(&["Scan.pdf", "scan.pdf"])),
            n(&["Scan.pdf", "scan (2).pdf"])
        );
        assert_eq!(
            unique_names(&n(&["scan.pdf", "SCAN.PDF", "scan (2).pdf"])),
            n(&["scan.pdf", "SCAN (3).PDF", "scan (2).pdf"])
        );
    }

    #[test]
    fn no_extension_and_dotfile() {
        assert_eq!(
            unique_names(&n(&["README", "README"])),
            n(&["README", "README (2)"])
        );
        assert_eq!(
            unique_names(&n(&[".gitignore", ".gitignore"])),
            n(&[".gitignore", ".gitignore (2)"])
        );
    }

    struct Entry {
        name: String,
        crc: u32,
        flags: usize,
        data: Vec<u8>,
    }

    fn u16_at(b: &[u8], i: usize) -> usize {
        usize::from(u16::from_le_bytes([b[i], b[i + 1]]))
    }
    fn u32_at(b: &[u8], i: usize) -> u32 {
        u32::from_le_bytes([b[i], b[i + 1], b[i + 2], b[i + 3]])
    }

    /// Test-only reader: walks the central directory, then reads each local entry.
    fn parse(z: &[u8]) -> Vec<Entry> {
        let eocd = z.len() - 22;
        assert_eq!(u32_at(z, eocd), 0x0605_4b50);
        let count = u16_at(z, eocd + 10);
        assert_eq!(
            u32_at(z, eocd + 12) as usize + u32_at(z, eocd + 16) as usize,
            eocd
        );
        let mut p = u32_at(z, eocd + 16) as usize;
        let mut v = Vec::new();
        for _ in 0..count {
            assert_eq!(u32_at(z, p), 0x0201_4b50);
            let flags = u16_at(z, p + 8);
            assert_eq!(u16_at(z, p + 10), 0, "stored");
            let crc = u32_at(z, p + 16);
            let size = u32_at(z, p + 20) as usize;
            assert_eq!(u32_at(z, p + 24) as usize, size);
            let nl = u16_at(z, p + 28);
            let off = u32_at(z, p + 42) as usize;
            let name = String::from_utf8(z[p + 46..p + 46 + nl].to_vec()).unwrap();
            assert_eq!(u32_at(z, off), 0x0403_4b50);
            assert_eq!(u16_at(z, off + 26), nl);
            let ds = off + 30 + nl;
            v.push(Entry {
                name,
                crc,
                flags,
                data: z[ds..ds + size].to_vec(),
            });
            p += 46 + nl;
        }
        assert_eq!(p, eocd);
        v
    }

    #[test]
    fn round_trip() {
        let a = vec![1u8, 2, 3];
        let b = vec![9u8; 1000];
        let z = zip_stored(&[("a.pdf", &a), ("relatório.pdf", &b), ("empty", &[])]).unwrap();
        let e = parse(&z);
        assert_eq!(e.len(), 3);
        assert_eq!(e[0].name, "a.pdf");
        assert_eq!(e[0].data, a);
        assert_eq!(e[0].crc, crc32fast::hash(&a));
        assert_eq!(e[1].name, "relatório.pdf");
        assert_eq!(e[1].data, b);
        assert!(e.iter().all(|x| x.flags & 0x0800 != 0));
        assert_eq!(e[2].data, Vec::<u8>::new());
    }

    #[test]
    fn empty_list_is_a_valid_zip() {
        let z = zip_stored(&[]).unwrap();
        assert_eq!(z.len(), 22);
        assert!(parse(&z).is_empty());
    }

    #[test]
    fn size_is_sum_plus_small_overhead() {
        let mb = vec![5u8; 1024 * 1024];
        let z = zip_stored(&[("a.jpg", &mb), ("b.jpg", &mb)]).unwrap();
        assert!(z.len() <= 2 * mb.len() + 2 * 1024);
    }

    #[test]
    fn length_limits() {
        assert_eq!(u16_len(65_535), Ok(65_535));
        assert_eq!(u16_len(65_536), Err(ZipError::TooLarge));
        // usize is 64-bit natively; the check matters on wasm32 only through offsets.
        #[cfg(target_pointer_width = "64")]
        {
            assert_eq!(u32_len(u32::MAX as usize), Ok(u32::MAX));
            assert_eq!(u32_len(u32::MAX as usize + 1), Err(ZipError::TooLarge));
        }
    }

    #[test]
    fn too_many_entries_is_too_large() {
        let entries = vec![("a", &[][..]); 65_536];
        let e = zip_stored(&entries).unwrap_err();
        assert_eq!(e, ZipError::TooLarge);
        assert_eq!(e.code(), "too_large");
    }
}
