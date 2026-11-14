# Harden log

## Pass 1 — 2026-11-14

### Baseline
- Commit: `b48cec5` (master, after #85 fixed #84)
- Scope: whole codebase (`src/index.ts`, its tests, README, packaging)
- Gate: `type-check`, `lint`, `oxfmt --check`, `bun test`, `build`: green
- Tests: 188 example tests in `src/index.test.ts`; line and function coverage 100%
- Oracles: none independent of the implementation; tests compare against hand-computed values
  and against `isValid(generate(...))`, which shares `computeSum`/`computeCheckDigit`
- Generators / fuzz targets: none
- Sanitizers: not applicable (pure TypeScript, no native code, no concurrency, no persistence)
- Tools added: Stryker 10 (`stryker.config.json`, command runner on `bun test`), fast-check 4,
  `bun test --coverage`

### Inventory: invariants

| # | Invariant | Checked by (before) | Checked by (now) |
|---|-----------|---------------------|------------------|
| I1 | `isValid(s)` ⇔ only digits/whitespace/`.`/`/`/`-`, exactly 11 digits, not all zero, Σ wᵢdᵢ (check weight 1) ≡ 0 mod 11 | example tests | + property test against independent reference |
| I2 | `generate(d, t)` is 11 digits and passes `isValid` | example tests, loop over sampled DNIs | + property test; one-off exhaustive check over all 10⁸ DNIs × 3 types |
| I3 | `generate` uses 20/27/30 unless that prefix has no check digit (remainder 1), then 23/23/33 with 9/4/9 | #84 regression tests | + property test (prefix choice derived from reference) |
| I4 | `generate` keeps the DNI (padded to 8, first 8 digits) | example tests | + property test |
| I5 | `generate` returns `""` for an unknown type | example test | same |
| I6 | `format` = prefix + sep + DNI + sep + check digit, with getters agreeing; pad/truncate to 11 | example tests | + property tests |
| I7 | `getEntityType` maps a prefix to the type that produced it | example tests | + property for M and E; F with prefix 23 → see open items |
| I8 | Published ESM/CJS entry points and `.d.ts`/`.d.cts` resolve and export the API | nothing (CI builds, never imports `dist`) | see step 6 |
| I9 | README and JSDoc examples match real output | nothing (5 wrong examples found while fixing #84) | see step 6 |

### Inventory: bug classes

| Class | Oracle that catches it (now) |
|-------|------------------------------|
| Checksum arithmetic at remainders 0 / 1 / 10 | property vs reference; exhaustive `generate` check; #84 tests |
| Separator and foreign-character handling | property over mixed digit/separator/arbitrary characters |
| Length handling (short, long, truncation, padding) | example tests + extra-trailing-digit test (from mutation run) |
| Prefix ↔ type mapping | example tests; generate prefix property; getEntityType property |
| Typing-error detection (substitution, transposition) | properties: every single substitution and adjacent transposition is rejected |
| Packaging / exports drift | nothing yet |
| Documentation drift | nothing yet |

### Mutation testing (Stryker, `src/index.ts`, 113 mutants)
- Before: 111 killed, 1 timeout, **1 survived**: `cuit.length !== 11` → `false` in `isValid`.
  Every "too long" test input also failed the checksum, so the length check was never what
  rejected it. Added "valid CUIT with extra trailing digits" test; watched it go red on the mutant.
- After: 112 killed, 1 timeout, 0 survived (100%).
- Timeout: `i++` → `i--` in `computeSum` loops forever; detected (the run never finishes), not equivalent.

### Dynamic checks
- Property tests (`src/index.property.test.ts`, 11 properties) shown to catch #84: against
  `34a29d4` four of them fail with counterexamples (`63321221540`, `97`/`E`, ...).
- Long run: `FC_RUNS=1000000`, 11 properties × 10⁶ cases, 18M assertions, 42 s, no failure.
- Exhaustive: `generate` over every 8-digit DNI × M/F/E (3×10⁸ calls) against the reference,
  5 min, 0 failures; the alternate prefix is used for exactly 9,090,909 DNIs per type (1/11).
- Sanitizers, crash-recovery, concurrency stress: not applicable.
