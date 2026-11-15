#!/bin/bash
# Runs every scaling workload in its own process. Usage: bench/scale.sh [node|bun] [filter]
set -eo pipefail
cd "$(dirname "$0")/.."
runtime=${1:-node}
for fn in "isValid digits" "isValid letter-at-end" "isValid separators" "isValid U+3000" "format digits"; do
  for size in 100k 200k 400k 800k; do
    name="scale $fn $size"
    [[ -n "$2" && ! "$name" =~ $2 ]] && continue
    pattern=$(printf '%s' "$name" | sed 's/[][\.*^$+?(){}|/]/\\&/g')
    $runtime bench/bench.mjs "^${pattern}\$" | tail -n +2
  done
done
