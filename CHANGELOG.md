# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/).

## [2.0.2] - 2026-11-14

### Fixed

- `isValid` accepted numbers whose checksum has no valid check digit (remainder 1) when they
  ended in `0`, such as `30-69345023-0` ([#84](https://github.com/brielov/cuit/issues/84)).
- `generate(dni, "E")` returned an invalid `30-…-0` CUIT where ARCA assigns prefix `33`; it now
  returns `33-…-9`, e.g. `generate("69345023", "E")` is `"33693450239"`
  ([#84](https://github.com/brielov/cuit/issues/84)).
- `getEntityType` reported women's `23-…-4` CUITs as male; for prefix `23` the check digit now
  decides.
- `isValid` threw a `TypeError` for numbers and arrays (for example a CUIT stored as a number);
  it now returns `false` for any non-string.
- The CommonJS build required `node:module`, which browser bundlers cannot resolve.
- Several README and JSDoc examples showed wrong results.

### Changed

- The `CuitPrefix` type includes `"33"`, which `generate` can now return.
- `isValid` and `generate` are about 30% faster on Node and 40–55% faster on Bun.

### Notes

- Version 2.0.1 on npm was published from a commit that is not in this repository and still
  has the [#84](https://github.com/brielov/cuit/issues/84) bug. From 2.0.2 on, releases are
  published by CI with npm provenance.

## [2.0.0] - 2026-01-24

- First release from this repository.

[2.0.2]: https://github.com/brielov/cuit/compare/5c0c62a...v2.0.2
[2.0.0]: https://github.com/brielov/cuit/tree/5c0c62a
