//! `bench <op> [--runs N] [--dir PATH]`: times an op on every file in the reference set.

use std::process::ExitCode;

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1);
    let mut op_name = None;
    let (mut runs, mut dir) = (5usize, String::from("bench/refset"));
    while let Some(a) = args.next() {
        match a.as_str() {
            "--runs" => runs = args.next().and_then(|v| v.parse().ok()).unwrap_or(0),
            "--dir" => match args.next() {
                Some(v) if !v.starts_with("--") => dir = v,
                _ => {
                    eprintln!("--dir needs a path");
                    return ExitCode::from(2);
                }
            },
            _ if a.starts_with("--") => {
                eprintln!("unknown flag \"{a}\"; known: --runs N, --dir PATH");
                return ExitCode::from(2);
            }
            _ => op_name = Some(a),
        }
    }
    let valid = staple_bench::OPS
        .iter()
        .map(|(n, _)| *n)
        .collect::<Vec<_>>()
        .join(", ");
    let name = op_name.unwrap_or_default();
    let Some(op) = staple_bench::find_op(&name) else {
        eprintln!("unknown operation \"{name}\"; valid: {valid}");
        return ExitCode::from(2);
    };
    if runs == 0 {
        eprintln!("--runs needs a positive number");
        return ExitCode::from(2);
    }
    let Ok(rd) = std::fs::read_dir(&dir) else {
        eprintln!("{dir} not found: run gen-refset first");
        return ExitCode::FAILURE;
    };
    let mut paths: Vec<_> = rd.filter_map(Result::ok).map(|e| e.path()).collect();
    paths.sort();
    let mut results = Vec::new();
    for p in paths.iter().filter(|p| {
        p.is_file() && (!name.starts_with("compress-") || p.extension().is_some_and(|e| e == "pdf"))
    }) {
        let Ok(bytes) = std::fs::read(p) else {
            eprintln!("cannot read {}", p.display());
            return ExitCode::FAILURE;
        };
        let (t, out_bytes) = match staple_bench::time_runs(op, &bytes, runs) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("{}: {e}", p.display());
                return ExitCode::FAILURE;
            }
        };
        let file = p
            .file_name()
            .map(|f| json_escape(&f.to_string_lossy()))
            .unwrap_or_default();
        results.push(format!(
            "{{\"file\":\"{file}\",\"operation\":\"{name}\",\"input_bytes\":{},\"output_bytes\":{out_bytes},\"median_ms\":{:.3},\"max_ms\":{:.3}}}",
            bytes.len(),
            staple_bench::median(&t),
            staple_bench::max(&t)
        ));
    }
    if results.is_empty() {
        eprintln!("{dir} has no files: run gen-refset first");
        return ExitCode::FAILURE;
    }
    println!(
        "{{\"caveat\":\"native timing only approximates WASM speed\",\"operation\":\"{name}\",\"runs\":{runs},\"results\":[{}]}}",
        results.join(",")
    );
    ExitCode::SUCCESS
}

/// Escapes a string for use inside a JSON string literal.
fn json_escape(s: &str) -> String {
    use std::fmt::Write;
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            c if c < ' ' => {
                let _ = write!(out, "\\u{:04x}", u32::from(c));
            }
            c => out.push(c),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::json_escape;

    #[test]
    fn escapes_quote_backslash_control() {
        assert_eq!(json_escape("a\"b\\c\n"), "a\\\"b\\\\c\\u000a");
    }
}
