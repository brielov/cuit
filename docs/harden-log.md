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

### Hunt 1 (CONTRACTS, INPUTS, FAILURE-PATHS; no CONCURRENCY: nothing runs in parallel)
Each claim was reproduced before being accepted.

| Claim | Verdict |
|-------|---------|
| Publish step has no pipefail, so failed publishes are green | confirmed (CI log of run 43635987861: `bash -e`, E404, run green) |
| npm `latest` 2.0.1 built from `d91539f` (not in repo) and still has #84 | confirmed; user action, see open items |
| package.json 2.0.0 is behind npm 2.0.1 | confirmed; user action, see open items |
| `getEntityType` maps 23-…-4 (female) to M | confirmed |
| `isValid` throws for number / array input | confirmed (property also shrank to `[]`) |
| CJS build has `require("node:module")`, breaks browser bundlers | confirmed (esbuild `--platform=browser`: Could not resolve "node:module") |
| README `CuitPrefix` lacks "33"; JSDoc examples wrong | confirmed |
| `getEntityType("20")` (bare prefix) returns null | rejected: every getter takes a CUIT and pads it; JSDoc now says "from a CUIT's prefix" |
| `isValid("00000000019")` true (unknown prefix) | rejected as a bug: I1 and the README define isValid as a mod-11 check; recorded as a decision for the user |

### Hunt 2 (same lenses, fresh hunters)
| Claim | Verdict |
|-------|---------|
| Conflict grep reads prepublishOnly output; a failing test quoting the phrase exits 0 | confirmed |
| Publish job cannot authenticate (placeholder token, npm 10.8.2 lacks OIDC login) | confirmed (same E404); user action, see open items |
| `CuitPrefix` omits 24 and 34, which `getEntityType` accepts | confirmed; public type change, recorded for the user |
| `FC_RUNS=abc` makes every property pass with 0 runs | confirmed gap; closed |
| Nothing loads `dist` on Node 18 (`engines`) | confirmed gap; closed |
| Stale test accepted M for a female CUIT | confirmed gap; closed |

### Bugs fixed
| Bug | Cause | Commit | What catches the class now |
|-----|-------|--------|----------------------------|
| Failed `npm publish` reported green | default `bash -e` has no pipefail; `tee` exit wins | `2dc074f` | `test/workflow.test.ts` runs the step under the shell GitHub picks with a fake npm |
| Female 23-…-4 CUITs reported as M | `getEntityType` ignored the check digit for shared prefix 23 | `15bad3d` | property `getEntityType(generate(d, t)) === t` for all types |
| `isValid` threw on non-strings | `RegExp.test` coerces, `normalize` does not | `cd9f2c9` | property over `fc.anything()` |
| CJS build required `node:module` | bunup default target `node` | `07e54e6` | `test/package.test.ts`: bundles import nothing, CJS/ESM export the source API |
| README/JSDoc drift | examples never executed | `0165823` | `test/docs.test.ts` runs every `fn(args); // result` example and compares the Types block |
| Failed prepublishOnly could grep as "already published" | conflict grep unanchored over all tee'd output | `cac9038` | workflow tests for the registry wording and quoted output |

Also: `63632af` (CI format check), `e160d14` (format), `55edfc9` (FC_RUNS guard, stale F test, docs fences, Node 18 smoke in CI).

### Final state
- Gate: type-check, lint, format, 262 tests, build, Node smoke: green.
- Mutation: 123 killed, 1 timeout (`i--` infinite loop, detected), 0 survived.
- Property tests at 200k cases after the fixes: green. Exhaustive `generate` check unchanged (logic untouched since).

### Open items for the user
1. **Publishing is broken.** The publish job sends setup-node's placeholder token; npm 10.8.2 (Node 20) cannot log in with OIDC. Either add `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`, or use trusted publishing: configure it on npmjs.com for this workflow and environment `npm`, and use Node 24 (npm ≥ 11.5.1). With pipefail, every master push is now red until this is fixed.
2. **npm `latest` (2.0.1) has #84** and came from `d91539f`, which is not in the repo. The next release must be > 2.0.1; releasing 2.0.1 again would hit the "already published" skip.
3. **`CuitPrefix`** omits 24 and 34 though `getEntityType` accepts them. Widening an exported type is an API decision.
4. **`isValid` does not check the prefix** (`00-00000001-9` passes). Decide whether it should reject prefixes outside 20/23/24/27/30/33/34.
5. **Non-string input**: only `isValid` is guarded; `format`, the getters and `generate` throw `TypeError` for numbers. Decide between documenting this and coercing.
6. `generate` keeps the first 8 digits of a longer DNI and accepts empty or letter-only input (tested, intended); consider documenting or rejecting.
7. CI uses `bun-version: latest`; pinning would make runs reproducible.
