# Contributing

Thanks for helping. Bug reports with an input that gives a wrong result are the most useful
thing you can send; please use the bug report form.

## Setup

You need [Bun](https://bun.sh).

```bash
bun install
bun test
```

## Before opening a pull request

Run the same checks as CI:

```bash
bun run type-check
bun run lint
bun run format:check
bun test
bun run build
```

`bun run format` fixes formatting.

## Guidelines

- **No runtime dependencies.** The package must stay dependency-free.
- **Size is a feature.** `test/package.test.ts` fails if the gzipped ESM bundle grows past 600
  bytes or the CJS bundle past 900. If a change really needs more, raise the limit in the same
  pull request and explain why.
- **Fix bugs with a test.** Add a test that fails before the fix. Behavior is checked against
  independent references in `src/index.property.test.ts`; extend those when a whole class of
  input was missed.
- **Keep the docs true.** Every `fn(args); // result` example in the README and the JSDoc is run
  by `test/docs.test.ts`.
- **Performance changes need numbers.** Benchmark the built package with `bench/bench.mjs`
  (`CUIT_DIST=<path>` compares another build) and include the bundle size change.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`fix:`, `feat:`, `perf:`, `docs:`, `test:`, `ci:`).

## Releases

Maintainers bump `version` in `package.json` and add a `CHANGELOG.md` entry. Merging to `master`
publishes to npm from CI with provenance; the release is then tagged `vX.Y.Z` on GitHub.
