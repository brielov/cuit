# cuit

[![npm version](https://img.shields.io/npm/v/cuit.svg)](https://www.npmjs.com/package/cuit)
[![npm downloads](https://img.shields.io/npm/dm/cuit.svg)](https://www.npmjs.com/package/cuit)
[![CI](https://github.com/brielov/cuit/actions/workflows/ci.yml/badge.svg)](https://github.com/brielov/cuit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Lightweight utilities for validating, formatting, and generating Argentine CUIT/CUIL numbers.

## What is a CUIT?

CUIT (Clave Única de Identificación Tributaria) is Argentina's tax identification number. It's an 11-digit number with the format `XX-XXXXXXXX-X`:

- **First 2 digits**: Type prefix (20/23/24 = male, 27 = female, 30/33/34 = company)
- **Middle 8 digits**: DNI (national ID) or company registration number
- **Last digit**: Check digit (mod 11 algorithm)

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

## Usage

```typescript
import { isValid, generate, format, normalize } from "cuit";

// Validate a CUIT
isValid("20-12345678-6"); // true
isValid("20-12345678-0"); // false (wrong check digit)
isValid("20123456786");   // true (works without separators)

// Generate a CUIT from a DNI
generate("12345678", "M"); // "20123456786" (male)
generate("12345678", "F"); // "27123456781" (female)
generate("12345678", "E"); // "30123456786" (entity/company)

// Format a CUIT
format("20123456786");      // "20-12345678-6"
format("20123456786", "/"); // "20/12345678/6"
format("20123456786", "");  // "20123456786"

// Normalize (remove separators)
normalize("20-12345678-6"); // "20123456786"
```

## API

### `isValid(input: string): boolean`

Validates whether a CUIT is valid using the mod 11 algorithm.

```typescript
isValid("20-12345678-6"); // true
isValid("invalid");       // false
isValid("20123456780");   // false (wrong check digit)
```

### `generate(dni: string, type: EntityType): string`

Generates a valid CUIT from a DNI and entity type.

- `dni` - The DNI number (8 digits, can include separators)
- `type` - `"M"` (male), `"F"` (female), or `"E"` (entity/company)

```typescript
generate("12345678", "M"); // "20123456786"
generate("12.345.678", "F"); // "27123456781" (separators are stripped)
generate("1234567", "M"); // "20012345672" (short DNIs are padded)
```

### `format(input: string, separator?: string): string`

Formats a CUIT with the specified separator (default: `"-"`).

```typescript
format("20123456786");      // "20-12345678-6"
format("20123456786", "/"); // "20/12345678/6"
format("20123456786", " "); // "20 12345678 6"
format("20123456786", "");  // "20123456786"
```

### `normalize(input: string): string`

Removes all non-digit characters from the input.

```typescript
normalize("20-12345678-6"); // "20123456786"
normalize("20.12345678.6"); // "20123456786"
```

### `getPrefix(input: string): string`

Extracts the 2-digit prefix from a CUIT.

```typescript
getPrefix("20-12345678-6"); // "20"
```

### `getDni(input: string): string`

Extracts the 8-digit DNI from a CUIT.

```typescript
getDni("20-12345678-6"); // "12345678"
```

### `getCheckDigit(input: string): string`

Extracts the check digit from a CUIT.

```typescript
getCheckDigit("20-12345678-6"); // "6"
```

### `getEntityType(input: string): EntityType | null`

Determines the entity type from a CUIT prefix.

```typescript
getEntityType("20-12345678-6"); // "M" (male)
getEntityType("27-12345678-1"); // "F" (female)
getEntityType("30-12345678-6"); // "E" (entity)
getEntityType("99-12345678-0"); // null (unknown prefix)
```

## Types

```typescript
type EntityType = "M" | "F" | "E";
type CuitPrefix = "20" | "23" | "27" | "30";
```

## Features

- Zero dependencies
- Full TypeScript support
- Works in Node.js, browsers, and edge runtimes
- ESM and CommonJS support
- Tree-shakeable
- Tiny bundle size (~800 bytes gzipped)

## License

[MIT](LICENSE)
