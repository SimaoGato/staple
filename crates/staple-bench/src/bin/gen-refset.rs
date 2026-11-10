//! Writes the reference file set to `bench/refset` (gitignored).

use std::path::Path;
use std::process::ExitCode;

fn main() -> ExitCode {
    match staple_bench::generate(Path::new("bench/refset"), &staple_bench::Spec::default()) {
        Ok(files) => {
            for (name, size) in files {
                println!("{name}\t{size}");
            }
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("gen-refset failed: {e}");
            ExitCode::FAILURE
        }
    }
}
