# cuit

[![npm version](https://img.shields.io/npm/v/cuit.svg)](https://www.npmjs.com/package/cuit)
[![npm downloads](https://img.shields.io/npm/dm/cuit.svg)](https://www.npmjs.com/package/cuit)
[![CI](https://github.com/brielov/cuit/actions/workflows/ci.yml/badge.svg)](https://github.com/brielov/cuit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Validate, format and generate Argentine CUIT and CUIL numbers. Zero dependencies, fully typed,
under 600 bytes gzipped.

```typescript
import { isValid, format, generate } from "cuit";

isValid("20-12345678-6"); // true
format("20123456786"); // "20-12345678-6"
generate("12345678", "F"); // "27123456780"
```

- **Correct check digits**, including the cases where the usual prefix has no valid check digit
  (`23-` and `33-` CUITs).
- **Strict validation, permissive helpers**: `isValid` rejects anything that is not a CUIT;
  `normalize`, `format` and the getters accept any input and never throw on strings.
- **Runs anywhere**: Node.js 18+, Bun, Deno, browsers and edge runtimes; ESM and CommonJS;
  tree-shakeable.
- **Small and checked**: the bundle size limit and every example in this README are verified in CI.

## Installation

```bash
npm install cuit
```

```bash
pnpm add cuit
```

```bash
bun add cuit
```

## What is a CUIT?

The CUIT (Clave Única de Identificación Tributaria) is the tax ID that ARCA, formerly AFIP,
assigns to people and companies in Argentina. The CUIL, used for employment and social
security, has the same structure. Both are 11 digits, usually written `XX-XXXXXXXX-X`:

| Part | Digits | Meaning |
|------|--------|---------|
| Prefix | 2 | `20` male, `27` female, `30` company. `23`, `24`, `33` and `34` are used in special cases (see below). |
| Body | 8 | The person's DNI, left-padded with zeros, or a number assigned to the company. |
| Check digit | 1 | Computed from the other 10 digits with a mod 11 algorithm. |

The check digit is `11 - (sum % 11)`, where `sum` multiplies the first 10 digits by
`5, 4, 3, 2, 7, 6, 5, 4, 3, 2`. A remainder of 0 gives check digit 0. A remainder of 1 would
give 10, which is not a digit, so the number is reassigned instead: men get prefix `23` with
check digit `9`, women `23` with `4`, and companies `33` with `9`. `generate` and
`getEntityType` follow these rules.

## API

### `isValid(input: string): boolean`

Returns `true` when `input` is a CUIT with a correct check digit. Separators are optional:
hyphens, dots, slashes and whitespace are allowed anywhere. Anything else makes it invalid,
including letters, a 12th digit, the all-zero number and non-string values (it never throws).

```typescript
isValid("20-12345678-6"); // true
isValid("20 12345678 6"); // true
isValid("20123456786"); // true
isValid("20-12345678-0"); // false (wrong check digit)
isValid("20-1234567X-6"); // false (letters are never stripped)
isValid("20-12345678-6-0"); // false (12 digits)
isValid("00000000000"); // false
```

To find a CUIT inside free text, extract it first; `isValid("CUIT 20-12345678-6")` is `false`.

### `generate(dni: string, type: EntityType): string`

Builds the CUIT for a DNI and an entity type: `"M"` (male), `"F"` (female) or `"E"` (company).
Non-digits in `dni` are ignored, shorter DNIs are left-padded with zeros and only the first 8
digits are used. Returns `""` for an unknown type.

```typescript
generate("12345678", "M"); // "20123456786"
generate("12345678", "E"); // "30123456781"
generate("12.345.678", "F"); // "27123456780"
generate("1234567", "M"); // "20012345675"
generate("10000005", "M"); // "23100000059" (20-10000005 has no valid check digit)
generate("10000002", "F"); // "23100000024"
generate("69345023", "E"); // "33693450239"
```

### `format(input: string, separator?: string): string`

Writes a CUIT as `XX-XXXXXXXX-X`, or with another separator. It takes the digits of `input`,
left-padded or truncated to 11, and does not validate them.

```typescript
format("20123456786"); // "20-12345678-6"
format("20123456786", "/"); // "20/12345678/6"
format("20-12345678-6", "."); // "20.12345678.6"
format("123456789"); // "00-12345678-9"
```

### `normalize(input: string): string`

Removes every character that is not a digit.

```typescript
normalize("20-12345678-6"); // "20123456786"
normalize("CUIT: 20.12345678/6"); // "20123456786"
```

### `getPrefix`, `getDni`, `getCheckDigit`

`getPrefix(input: string): string`, `getDni(input: string): string` and
`getCheckDigit(input: string): string` return the parts of a CUIT, reading the digits the same
way `format` does.

```typescript
getPrefix("20-12345678-6"); // "20"
getDni("20-12345678-6"); // "12345678"
getCheckDigit("20-12345678-6"); // "6"
```

### `getEntityType(input: string): EntityType | null`

Tells from the prefix whether a CUIT belongs to a man, a woman or a company. For prefix `23`,
the check digit decides: `4` is female, anything else male. Returns `null` for an unknown
prefix.

```typescript
getEntityType("20-12345678-6"); // "M"
getEntityType("27-12345678-0"); // "F"
getEntityType("23-10000005-9"); // "M"
getEntityType("23-10000002-4"); // "F"
getEntityType("30-12345678-1"); // "E"
getEntityType("33-69345023-9"); // "E"
getEntityType("99-12345678-0"); // null
```

## Types

```typescript
type EntityType = "M" | "F" | "E";
type CuitPrefix = "20" | "23" | "27" | "30" | "33";
```

`CuitPrefix` lists the prefixes `generate` can return.

## Development

This project uses [Bun](https://bun.sh).

```bash
bun install
bun test             # unit, property, packaging, docs and CI workflow tests
bun run type-check
bun run lint
bun run format:check
bun run mutation     # mutation testing with Stryker
```

`bun run build && node bench/bench.mjs` benchmarks the built package. See
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE) © Gabriel Vaquer
