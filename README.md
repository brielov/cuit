# cuit

## Installation

```
npm install cuit
```

## Usage

### Validate CUIT/CUIL

```typescript
import { is } from "cuit";

const isValid = is("20-21834641-4"); // => true
```

### Guess CUIT/CUIL based on someone's DNI

```typescript
import { guess } from "cuit";

const dni = "21834641";

// "M" for male, "F" for female and "E" for business / "Persona Jurídica"
const cuit = guess(dni, "M"); // => 20-21834641-4
```
