#![allow(
    clippy::unwrap_used,
    clippy::float_cmp,
    clippy::case_sensitive_file_extension_comparisons
)]
use sha2::{Digest, Sha256};
use staple_bench::{Spec, generate, max, median};
use std::path::{Path, PathBuf};
use std::process::Command;

fn tmp(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("staple-bench-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    d
}

fn hashes(dir: &Path) -> Vec<(String, String)> {
    let mut v: Vec<_> = std::fs::read_dir(dir)
        .unwrap()
        .map(|e| {
            let p = e.unwrap().path();
            let h = Sha256::digest(std::fs::read(&p).unwrap())
                .iter()
                .map(ToString::to_string)
                .collect::<Vec<_>>()
                .join(",");
            (p.file_name().unwrap().to_string_lossy().into_owned(), h)
        })
        .collect();
    v.sort();
    v
}

#[test]
fn generation_is_deterministic() {
    let (a, b) = (tmp("a"), tmp("b"));
    generate(&a, &Spec::small()).unwrap();
    generate(&b, &Spec::small()).unwrap();
    let (ha, hb) = (hashes(&a), hashes(&b));
    assert_eq!(ha.len(), 13);
    assert_eq!(ha, hb);
}

#[test]
fn pdfs_are_well_formed() {
    let d = tmp("pdf");
    generate(&d, &Spec::small()).unwrap();
    for (name, pages) in [
        ("image-heavy-20mb.pdf", 3),
        ("text-1mb.pdf", 4),
        ("pages-200.pdf", 6),
    ] {
        let b = std::fs::read(d.join(name)).unwrap();
        assert!(b.starts_with(b"%PDF-"));
        assert!(b.ends_with(b"%%EOF\n"));
        let s = String::from_utf8_lossy(&b);
        assert_eq!(s.matches("/Type /Page ").count(), pages, "{name}");
        let xref = s.rfind("\nxref\n").unwrap() + 1;
        for (i, line) in s[xref..]
            .lines()
            .skip(3)
            .take_while(|l| l.ends_with(" n "))
            .enumerate()
        {
            let off: usize = line[..10].parse().unwrap();
            assert!(
                b[off..].starts_with(format!("{} 0 obj", i + 1).as_bytes()),
                "{name} obj {}",
                i + 1
            );
        }
    }
}

#[test]
fn median_and_max() {
    assert_eq!(median(&[3.0]), 3.0);
    assert_eq!(median(&[3.0, 1.0, 2.0]), 2.0);
    assert_eq!(median(&[4.0, 1.0, 2.0, 3.0]), 2.5);
    assert_eq!(max(&[1.0, 9.0, 2.0]), 9.0);
}

#[test]
fn bench_prints_json_per_file() {
    let d = tmp("run");
    generate(&d, &Spec::small()).unwrap();
    let out = Command::new(env!("CARGO_BIN_EXE_bench"))
        .args(["demo", "--runs", "2", "--dir"])
        .arg(&d)
        .output()
        .unwrap();
    assert!(out.status.success());
    let s = String::from_utf8(out.stdout).unwrap();
    assert!(s.contains("\"caveat\""));
    assert_eq!(s.matches("\"median_ms\"").count(), 13);
    assert_eq!(s.matches("\"max_ms\"").count(), 13);
    assert_eq!(s.matches("\"operation\":\"demo\"").count(), 14);
    assert!(s.contains("\"file\":\"text-1mb.pdf\""));
}

#[test]
fn unknown_op_exits_nonzero_listing_valid() {
    let out = Command::new(env!("CARGO_BIN_EXE_bench"))
        .arg("nope")
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&out.stderr).contains("valid: demo"));
}

#[test]
fn unknown_flag_and_missing_dir_value_exit_2() {
    for args in [&["demo", "--run", "3"][..], &["demo", "--dir"][..]] {
        let out = Command::new(env!("CARGO_BIN_EXE_bench"))
            .args(args)
            .output()
            .unwrap();
        assert_eq!(out.status.code(), Some(2), "{args:?}");
    }
}

/// Full-size set: slow, run with `cargo test -p staple-bench --release -- --ignored`.
#[test]
#[ignore = "slow: generates the full 20 MB + 12 MP set"]
fn full_spec_sizes() {
    let d = tmp("full");
    let files = generate(&d, &Spec::default()).unwrap();
    let size = |n: &str| files.iter().find(|f| f.0 == n).unwrap().1;
    assert!((18_000_000..=22_000_000).contains(&size("image-heavy-20mb.pdf")));
    assert!((800_000..=1_300_000).contains(&size("text-1mb.pdf")));
    assert_eq!(files.len(), 13);
    for (n, _) in files.iter().filter(|f| f.0.ends_with(".png")) {
        let dec = png::Decoder::new(std::io::BufReader::new(
            std::fs::File::open(d.join(n)).unwrap(),
        ));
        let r = dec.read_info().unwrap();
        assert_eq!(r.info().width * r.info().height, 12_000_000);
    }
}
