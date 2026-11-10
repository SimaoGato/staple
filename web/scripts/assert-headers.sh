#!/usr/bin/env bash
# Usage: assert-headers.sh <base-url>
# Asserts the CSP, COOP and COEP headers on the deployed site (STORY-05 AC8).
# Retries because Cloudflare's edge serves the previous version for a few
# seconds after `wrangler deploy` returns.
set -u
url=$1
attempts=${HEADER_CHECK_ATTEMPTS:-12}
delay=${HEADER_CHECK_DELAY:-5}

check() {
  local fail=0 path headers want
  for path in / /merge; do
    headers=$(curl -sSIL "$url$path")
    for want in \
      "content-security-policy:.*default-src 'self'" \
      "content-security-policy:.*connect-src 'self'" \
      "content-security-policy:.*script-src 'self' 'wasm-unsafe-eval'" \
      "content-security-policy:.*object-src 'none'" \
      "content-security-policy:.*base-uri 'none'" \
      "content-security-policy:.*frame-ancestors 'none'" \
      "cross-origin-opener-policy: same-origin" \
      "cross-origin-embedder-policy: require-corp"; do
      echo "$headers" | grep -qiE "^$want" || { echo "MISSING on $path: $want"; fail=1; }
    done
  done
  return $fail
}

for ((i = 1; i <= attempts; i++)); do
  check && exit 0
  echo "attempt $i/$attempts failed"
  ((i < attempts)) && sleep "$delay"
done
exit 1
