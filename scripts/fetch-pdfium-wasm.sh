#!/usr/bin/env bash
# Fetches the pinned prebuilt PDFium WASM (paulocoutinhox/pdfium-lib) into web/pdfium-wasm/ (gitignored).
set -euo pipefail
TAG=8046d
SHA256=062d10055de90a01120acf307ce16e0022021a32203f4aeae4877750f9a08427
OUT="$(cd "$(dirname "$0")/.." && pwd)/web/pdfium-wasm"
# Cache hit skips the hash check: files in web/pdfium-wasm are trusted once fetched (delete it to refetch).
[ -f "$OUT/pdfium.esm.wasm" ] && [ -f "$OUT/pdfium.esm.js" ] && exit 0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL -o "$tmp/wasm.zip" "https://github.com/paulocoutinhox/pdfium-lib/releases/download/$TAG/wasm.zip"
echo "$SHA256  $tmp/wasm.zip" | { command -v sha256sum >/dev/null && sha256sum -c - || shasum -a 256 -c -; } # macOS has only shasum
python3 -m zipfile -e "$tmp/wasm.zip" "$tmp/x"
mkdir -p "$OUT"
cp "$tmp/x/release/node/pdfium.esm.js" "$tmp/x/release/node/pdfium.esm.wasm" "$OUT/"
