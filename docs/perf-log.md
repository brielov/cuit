# Performance log

## Full pass 1 — 2026-11-14 (from `c117f06`)

### Outcome
One change kept: reading digits with `charCodeAt(i) - 48` instead of `parseInt(digits[i], 10)`.
A longer pass (branch `perf`, not merged) made `isValid` ~5× faster, but grew the ESM bundle
from 586 to 1,072 B gzipped (+83%). For a library sold as tiny, the size matters more than
nanoseconds no user notices, so that work was dropped and a size limit added (see below).

### Environment and method
- AMD Ryzen 9 5900X, governor `performance`; Node v26.13.0 (V8), Bun 1.4.4 (JSC); benchmarks run
  the built `dist/index.js`.
- `bench/bench.mjs` (mitata): realistic inputs rotated through 1,024 flat strings; every string
  result is read once (Bun builds concatenations lazily and pays on first read).
  `CUIT_DIST=<path>` benchmarks another build; `bench/scale.sh` runs each oversized-input
  workload in its own process.
- Noise threshold 10% (largest run-to-run spread); compare builds alternately, not in sequence.
- Profiling: `perf record -e cpu-clock:u` with `node --perf-basic-prof` (no call graphs on this
  machine).

### Kept: `charCodeAt` instead of `parseInt` (+3 B gzipped)
- Evidence: `Builtins_ParseInt` was 22% of `isValid` and 32% of `generate`, each call also cutting
  a one-character substring. The digits are ASCII 0–9 at that point, so the values are identical.
- Result (median of 3, Node / Bun): `isValid` plain 117 → 80 / 107 → 48 ns, wrong check digit
  118 → 79 / 110 → 48 ns, formatted 167 → 137 / 151 → 89 ns, `generate` 117 → 82 / 138 → 80 ns,
  10k bulk validation 1.21 → 0.92 / 1.07 → 0.59 ms. Other functions unchanged.

### Dropped (size)
Measured size cost of the `perf` branch's larger wins (ESM, gzip): one-pass `isValid` +111 B
(`isValid` −56..64%), straight-line common-shape `isValid` +135 B (−23% Node), getters and
`format` slicing common shapes directly +104 B (getters −47..61%), `normalize` fast paths
+31..52 B. Absolute gains were ~0.1 µs per call, ~1 ms per 10k validations.

### Lessons
- Check bundle size on every change; `test/package.test.ts` now fails when the gzipped ESM
  bundle exceeds 600 B or the CJS bundle 900 B.
- Read string results in benchmarks, or engines with lazy strings look faster than they are.
- Verify "equivalent" mutation survivors mechanically (apply the mutant, diff against a
  reference), not by argument; several presumed-equivalent ones were real test gaps.
