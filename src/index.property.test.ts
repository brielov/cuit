import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
  format,
  generate,
  getCheckDigit,
  getDni,
  getEntityType,
  getPrefix,
  isValid,
  normalize,
  type EntityType,
} from "./index.ts";

/** Raise with FC_RUNS=100000 bun test for a long run. */
const numRuns = Number(process.env.FC_RUNS ?? 1000);

/**
 * Independent reference: a CUIT is valid when the weighted sum of all 11 digits,
 * with weight 1 on the check digit, is divisible by 11. This needs no special
 * case for remainder 1: no single check digit can make such a sum divisible.
 */
const REF_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 1];
function referenceIsValid(input: string): boolean {
  for (const ch of input) {
    const isDigit = ch >= "0" && ch <= "9";
    if (!isDigit && !/^[\s./-]$/.test(ch)) return false;
  }
  const digits = [...input].filter((ch) => ch >= "0" && ch <= "9");
  if (digits.length !== 11 || digits.every((d) => d === "0")) return false;
  const sum = digits.reduce((acc, d, i) => acc + Number(d) * REF_WEIGHTS[i]!, 0);
  return sum % 11 === 0;
}

const digitString = (min: number, max: number) =>
  fc.string({ unit: fc.constantFrom(..."0123456789"), minLength: min, maxLength: max });

/** 11 digits whose checksum is correct, built by brute-forcing the check digit. */
const validCuit = fc
  .tuple(fc.constantFrom("20", "23", "24", "27", "30", "33", "34"), digitString(8, 8))
  .filter(([p, b]) => [..."0123456789"].some((c) => referenceIsValid(p + b + c)))
  .map(([p, b]) => {
    const c = [..."0123456789"].find((c) => referenceIsValid(p + b + c))!;
    return p + b + c;
  });

const separator = fc.constantFrom("", "-", ".", "/", " ", "\t", " ");
const entityType = fc.constantFrom<EntityType>("M", "F", "E");

describe("isValid matches the reference", () => {
  test("on digit strings of any length", () => {
    fc.assert(
      fc.property(digitString(0, 14), (s) => {
        expect(isValid(s)).toBe(referenceIsValid(s));
      }),
      { numRuns },
    );
  });

  test("on 11-digit strings (checksum boundary)", () => {
    fc.assert(
      fc.property(digitString(11, 11), (s) => {
        expect(isValid(s)).toBe(referenceIsValid(s));
      }),
      { numRuns },
    );
  });

  test("on strings mixing digits, separators and other characters", () => {
    const unit = fc.oneof(
      { weight: 8, arbitrary: fc.constantFrom(..."0123456789") },
      { weight: 2, arbitrary: fc.constantFrom("-", ".", "/", " ", "\t", "\n", " ") },
      { weight: 1, arbitrary: fc.string({ unit: "binary", minLength: 1, maxLength: 1 }) },
    );
    fc.assert(
      fc.property(fc.string({ unit, minLength: 0, maxLength: 20 }), (s) => {
        expect(isValid(s)).toBe(referenceIsValid(s));
      }),
      { numRuns },
    );
  });

  test("on valid CUITs written with any separator", () => {
    fc.assert(
      fc.property(validCuit, separator, (c, sep) => {
        expect(isValid(c)).toBe(true);
        expect(isValid(format(c, sep))).toBe(true);
      }),
      { numRuns },
    );
  });
});

describe("isValid on input from untyped JavaScript callers", () => {
  test("never throws and is false for anything that is not a string", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        fc.pre(typeof value !== "string");
        expect(isValid(value as unknown as string)).toBe(false);
      }),
      { numRuns },
    );
  });

  test("is false for a valid CUIT held as a number or in an array", () => {
    expect(isValid(20123456786 as unknown as string)).toBe(false);
    expect(isValid(["20123456786"] as unknown as string)).toBe(false);
    expect(isValid(null as unknown as string)).toBe(false);
  });
});

describe("the checksum detects typing errors", () => {
  test("any single-digit substitution of a valid CUIT is invalid", () => {
    fc.assert(
      fc.property(
        validCuit,
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 1, max: 9 }),
        (c, pos, delta) => {
          const d = (Number(c[pos]) + delta) % 10;
          const mutated = c.slice(0, pos) + d + c.slice(pos + 1);
          expect(isValid(mutated)).toBe(false);
        },
      ),
      { numRuns },
    );
  });

  test("any adjacent transposition of distinct digits is invalid", () => {
    fc.assert(
      fc.property(validCuit, fc.integer({ min: 0, max: 9 }), (c, pos) => {
        fc.pre(c[pos] !== c[pos + 1]);
        const swapped = c.slice(0, pos) + c[pos + 1] + c[pos] + c.slice(pos + 2);
        expect(isValid(swapped)).toBe(false);
      }),
      { numRuns },
    );
  });
});

describe("generate", () => {
  const PREFIXES: Record<EntityType, [string, string]> = {
    M: ["20", "23"],
    F: ["27", "23"],
    E: ["30", "33"],
  };

  test("returns a valid 11-digit CUIT with the expected DNI and prefix", () => {
    fc.assert(
      fc.property(fc.oneof(digitString(0, 12), fc.string()), entityType, (dni, type) => {
        const cuit = generate(dni, type);
        expect(cuit).toMatch(/^\d{11}$/);
        expect(isValid(cuit)).toBe(true);
        expect(getDni(cuit)).toBe(normalize(dni).padStart(8, "0").slice(0, 8));
        const [primary, alternate] = PREFIXES[type];
        // The alternate prefix is used exactly when the primary has no valid check digit
        const primaryWorks = [..."0123456789"].some((d) =>
          referenceIsValid(primary + getDni(cuit) + d),
        );
        expect(getPrefix(cuit)).toBe(primaryWorks ? primary : alternate);
      }),
      { numRuns },
    );
  });

  test("is unaffected by separators in the DNI", () => {
    fc.assert(
      fc.property(digitString(8, 8), separator, entityType, (dni, sep, type) => {
        const written = `${dni.slice(0, 2)}${sep}${dni.slice(2, 5)}${sep}${dni.slice(5)}`;
        expect(generate(written, type)).toBe(generate(dni, type));
      }),
      { numRuns },
    );
  });

  test("getEntityType recovers the type a CUIT was generated for", () => {
    fc.assert(
      fc.property(digitString(8, 8), entityType, (dni, type) => {
        expect(getEntityType(generate(dni, type))).toBe(type);
      }),
      { numRuns },
    );
  });
});

describe("format and the getters agree", () => {
  test("format is prefix + DNI + check digit joined by the separator", () => {
    fc.assert(
      fc.property(fc.string(), separator, (s, sep) => {
        const formatted = format(s, sep);
        expect(formatted).toBe([getPrefix(s), getDni(s), getCheckDigit(s)].join(sep));
        expect(normalize(formatted)).toBe(normalize(s).padStart(11, "0").slice(0, 11));
      }),
      { numRuns },
    );
  });

  test("format round-trips an 11-digit CUIT", () => {
    fc.assert(
      fc.property(digitString(11, 11), separator, (c, sep) => {
        expect(normalize(format(c, sep))).toBe(c);
        expect(format(format(c))).toBe(format(c));
      }),
      { numRuns },
    );
  });
});
