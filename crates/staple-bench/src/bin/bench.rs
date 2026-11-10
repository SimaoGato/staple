//! `bench <op> [--runs N] [--dir PATH]`: times an op on every file in the reference set.

use std::process::ExitCode;

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1);
    let mut op_name = None;
    let (mut runs, mut dir) = (5usize, String::from("bench/refset"));
    while let Some(a) = args.next() {
        match a.as_str() {
            "--runs" => runs = args.next().and_then(|v| v.parse().ok()).unwrap_or(0),
            "--dir" => dir = args.next().unwrap_or_default(),
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
    for p in paths.iter().filter(|p| p.is_file()) {
        let Ok(bytes) = std::fs::read(p) else {
            eprintln!("cannot read {}", p.display());
            return ExitCode::FAILURE;
        };
        let t = staple_bench::time_runs(op, &bytes, runs);
        let file = p
            .file_name()
            .map(|f| f.to_string_lossy().into_owned())
            .unwrap_or_default();
        results.push(format!(
            "{{\"file\":\"{file}\",\"operation\":\"{name}\",\"median_ms\":{:.3},\"max_ms\":{:.3}}}",
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
