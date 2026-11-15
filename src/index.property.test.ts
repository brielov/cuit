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
/** The exhaustive code-unit tests take seconds under mutation-testing instrumentation. */
const EXHAUSTIVE_TIMEOUT = 60_000;
// fast-check passes a property after 0 runs, so a bad FC_RUNS would test nothing
if (!Number.isInteger(numRuns) || numRuns < 1) {
  throw new Error(`FC_RUNS must be a positive integer, got ${process.env.FC_RUNS}`);
}

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

  test(
    "for every UTF-16 code unit used as a separator or stray character",
    () => {
      // Which characters count as separators is easy to get subtly wrong; check every unit
      for (let code = 0; code < 0x10000; code++) {
        const ch = String.fromCharCode(code);
        for (const s of [`20${ch}12345678${ch}6`, `${ch}20123456786`, `2012345678${ch}0`]) {
          if (isValid(s) !== referenceIsValid(s)) {
            throw new Error(`U+${code.toString(16).padStart(4, "0")} in ${JSON.stringify(s)}`);
          }
        }
      }
    },
    EXHAUSTIVE_TIMEOUT,
  );

  test("with any ASCII character replacing any position of a valid CUIT", () => {
    // A corrupted CUIT must never pass, so corrupt every position of several valid ones
    const chars = [
      ...Array.from({ length: 128 }, (_, c) => String.fromCharCode(c)),
      "\u00a0",
      "\u0660",
      "\u2028",
      "\ud800",
    ];
    const valid = ["20123456786", "27100000024", "33693450239", "23100000059", "30123456781"];
    for (const cuit of valid) {
      for (const base of [cuit, format(cuit), format(cuit, " ")]) {
        for (let pos = 0; pos < base.length; pos++) {
          for (const ch of chars) {
            const s = base.slice(0, pos) + ch + base.slice(pos + 1);
            if (isValid(s) !== referenceIsValid(s)) throw new Error(JSON.stringify(s));
          }
        }
      }
    }
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

describe("normalize and the getters on input from untyped JavaScript callers", () => {
  test("throw a TypeError for anything that is not a string", () => {
    const fns = [normalize, format, getPrefix, getDni, getCheckDigit, getEntityType];
    fc.assert(
      fc.property(fc.anything(), (value) => {
        fc.pre(typeof value !== "string");
        for (const fn of fns) expect(() => fn(value as unknown as string)).toThrow(TypeError);
        expect(() => generate(value as unknown as string, "M")).toThrow(TypeError);
      }),
      { numRuns },
    );
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

/** What the getters are defined to read: the first 11 digits, left-padded with zeros. */
const referencePad = (s: string) =>
  s
    .split("")
    .filter((ch) => ch >= "0" && ch <= "9")
    .join("")
    .padStart(11, "0")
    .slice(0, 11);

function matchesReferencePad(s: string): boolean {
  const p = referencePad(s);
  return (
    getPrefix(s) === p.slice(0, 2) &&
    getDni(s) === p.slice(2, 10) &&
    getCheckDigit(s) === p.slice(10) &&
    format(s, "/") === `${p.slice(0, 2)}/${p.slice(2, 10)}/${p.slice(10)}` &&
    getEntityType(s) === getEntityType(p)
  );
}

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

  test(
    "match a reference pad for every UTF-16 code unit in the separator and digit positions",
    () => {
      // Check format and the getters against their definition, whatever the separator
      for (let code = 0; code < 0x10000; code++) {
        const ch = String.fromCharCode(code);
        for (const s of [
          `20${ch}12345678${ch}6`,
          `20-12345678${ch}6`,
          `2${ch}123456786`,
          `20${ch}123456786`,
        ]) {
          if (!matchesReferencePad(s)) {
            throw new Error(`U+${code.toString(16).padStart(4, "0")} in ${JSON.stringify(s)}`);
          }
        }
      }
    },
    EXHAUSTIVE_TIMEOUT,
  );

  test("match a reference pad with any ASCII character at any position of the common shapes", () => {
    // Bases without zeros, so a "0" at a separator position cannot pass for a separator
    const chars = [
      ...Array.from({ length: 128 }, (_, c) => String.fromCharCode(c)),
      "\u00a0",
      "\u0660",
      "\ud800",
      "\uffff",
    ];
    for (const base of ["21345678912", "21-34567891-2", "2134567891234"]) {
      for (let pos = 0; pos < base.length; pos++) {
        for (const ch of chars) {
          const s = base.slice(0, pos) + ch + base.slice(pos + 1);
          if (!matchesReferencePad(s)) throw new Error(JSON.stringify(s));
        }
      }
    }
  });

  test("match a reference pad on 11- and 13-character strings that are mostly not digits", () => {
    // Mostly non-digit strings of CUIT length: all non-digits, and one digit anywhere
    for (const filler of [" ", "-", ".", "/", "a", "\u00a0", "\u0660"]) {
      for (const length of [11, 13]) {
        const blank = filler.repeat(length);
        if (!matchesReferencePad(blank)) throw new Error(JSON.stringify(blank));
        for (let pos = 0; pos < length; pos++) {
          for (const digit of ["0", "7"]) {
            const s = blank.slice(0, pos) + digit + blank.slice(pos + 1);
            if (!matchesReferencePad(s)) throw new Error(JSON.stringify(s));
          }
        }
      }
    }
  });

  test("normalize matches the reference around the formatted shape", () => {
    // Near the `XX-XXXXXXXX-X` shape, normalize must still strip exactly the non-digits
    const strip = (s: string) => s.replace(/[^0-9]/g, "");
    const chars = Array.from({ length: 128 }, (_, c) => String.fromCharCode(c));
    const cases = [
      "20-abcdefgh-6",
      "20-1234567x-6",
      "20-12345678-x",
      "20-12345678-",
      "2-12345678-6",
    ];
    for (const base of ["20-12345678-6", "21 34567891 2"]) {
      cases.push(base + "x", "x" + base, base + "7", base.slice(0, 12), base.slice(1));
      for (let pos = 0; pos < base.length; pos++) {
        for (const ch of chars) cases.push(base.slice(0, pos) + ch + base.slice(pos + 1));
      }
    }
    for (const s of cases) {
      if (normalize(s) !== strip(s)) throw new Error(JSON.stringify(s));
    }
  });

  test("normalize, format and the getters handle long input (past the short-input fast path)", () => {
    for (const s of [
      "20-12345678-6" + " -".repeat(20),
      "x".repeat(40) + "20123456786",
      "1".repeat(40),
      "CUIT del cliente: 20.123.456.78-6 (verificado)",
      "2:1-2.3/4 5\u00a06\u20607a8b9c0d1e2f3 / ref. 4-5-6",
    ]) {
      expect(s.length).toBeGreaterThan(32);
      expect(normalize(s)).toBe(s.replace(/[^0-9]/g, ""));
      if (!matchesReferencePad(s)) throw new Error(JSON.stringify(s));
    }
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
