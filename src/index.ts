/**
 * CUIT (Clave Única de Identificación Tributaria) utilities for Argentina.
 *
 * A CUIT is an 11-digit tax identification number used in Argentina.
 * Format: XX-XXXXXXXX-X (prefix-DNI-checkDigit)
 *
 * Prefixes:
 * - 20: Male individuals
 * - 23: Male/Female (special cases when check digit would be invalid)
 * - 27: Female individuals
 * - 30: Legal entities (companies)
 * - 33: Legal entities (special case when check digit would be invalid)
 */

/** Weights used in the check digit algorithm (mod 11) */
const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/** Valid entity types for CUIT generation */
export type EntityType = "M" | "F" | "E";

/** Valid CUIT prefixes */
export type CuitPrefix = "20" | "23" | "27" | "30" | "33";

/**
 * Removes all non-digit characters from the input.
 */
export function normalize(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Normalizes and pads input to exactly 11 digits.
 */
function pad(input: string): string {
  return normalize(input).padStart(11, "0").slice(0, 11);
}

/**
 * Computes the weighted sum used in check digit calculation.
 */
function computeSum(digits: string): number {
  let sum = 0;
  for (let i = 0; i < WEIGHTS.length; i++) {
    sum += (digits.charCodeAt(i) - 48) * WEIGHTS[i]!;
  }
  return sum;
}

/**
 * Computes the expected check digit from the weighted sum remainder.
 * A remainder of 1 yields 10, which no single digit can match: such a
 * prefix + DNI combination has no valid check digit.
 */
function computeCheckDigit(remainder: number): number {
  return remainder === 0 ? 0 : 11 - remainder;
}

/**
 * Validates whether a CUIT is valid.
 * Allows whitespace, hyphens, dots, and slashes as separators. Rejects other
 * characters, all-zero input and non-string values before checking the mod 11 checksum.
 *
 * @example
 * ```ts
 * isValid("20-12345678-6") // true
 * isValid("20123456786")   // true (works without separators)
 * isValid("20-12345678-0") // false (wrong check digit)
 * ```
 */
export function isValid(input: string): boolean {
  // A predicate must not throw: callers without type checking may pass numbers or arrays
  if (typeof input !== "string" || /[^0-9\s./-]/.test(input)) return false;
  const cuit = normalize(input);
  if (cuit.length !== 11 || cuit === "00000000000") return false;

  const expected = computeCheckDigit(computeSum(cuit) % 11);
  const actual = cuit.charCodeAt(10) - 48;

  return actual === expected;
}

/**
 * Generates a CUIT from a DNI and entity type.
 *
 * @param dni - The DNI number (can include separators)
 * @param type - The entity type: "M" (male), "F" (female), or "E" (entity/company)
 * @returns The generated CUIT as an 11-digit string, or empty string if invalid type
 *
 * @example
 * ```ts
 * generate("12345678", "M") // "20123456786"
 * generate("12345678", "F") // "27123456780"
 * generate("12345678", "E") // "30123456781"
 * ```
 */
export function generate(dni: string, type: EntityType): string {
  if (type !== "M" && type !== "F" && type !== "E") return "";

  const body = normalize(dni).padStart(8, "0").slice(0, 8);
  let prefix: CuitPrefix = type === "F" ? "27" : type === "M" ? "20" : "30";

  let checkDigit = computeCheckDigit(computeSum(prefix + body) % 11);

  // No valid check digit exists for this prefix (remainder 1): switch to the
  // alternate prefix, which always yields a fixed check digit.
  if (checkDigit === 10) {
    if (type === "E") {
      prefix = "33";
      checkDigit = 9;
    } else {
      prefix = "23";
      checkDigit = type === "M" ? 9 : 4;
    }
  }

  return `${prefix}${body}${checkDigit}`;
}

/**
 * Formats a CUIT with the specified separator.
 *
 * @example
 * ```ts
 * format("20123456786")      // "20-12345678-6"
 * format("20123456786", "/") // "20/12345678/6"
 * ```
 */
export function format(input: string, separator: string = "-"): string {
  const cuit = pad(input);
  return `${cuit.slice(0, 2)}${separator}${cuit.slice(2, 10)}${separator}${cuit.slice(10)}`;
}

/**
 * Extracts the prefix from a CUIT.
 *
 * @example
 * ```ts
 * getPrefix("20-12345678-6") // "20"
 * ```
 */
export function getPrefix(input: string): string {
  return pad(input).slice(0, 2);
}

/**
 * Extracts the DNI from a CUIT.
 *
 * @example
 * ```ts
 * getDni("20-12345678-6") // "12345678"
 * ```
 */
export function getDni(input: string): string {
  return pad(input).slice(2, 10);
}

/**
 * Extracts the check digit from a CUIT.
 *
 * @example
 * ```ts
 * getCheckDigit("20-12345678-6") // "6"
 * ```
 */
export function getCheckDigit(input: string): string {
  return pad(input).slice(10);
}

/**
 * Determines the entity type from a CUIT's prefix.
 *
 * Prefix 23 is shared: `generate` assigns it to both males (check digit 9) and
 * females (check digit 4), so for 23 the check digit decides.
 *
 * @returns The entity type, or `null` if unknown prefix
 *
 * @example
 * ```ts
 * getEntityType("20-12345678-6") // "M"
 * getEntityType("27-12345678-0") // "F"
 * getEntityType("23-10000002-4") // "F"
 * getEntityType("30-12345678-1") // "E"
 * ```
 */
export function getEntityType(input: string): EntityType | null {
  switch (getPrefix(input)) {
    case "23":
      return getCheckDigit(input) === "4" ? "F" : "M";
    case "20":
    case "24":
      return "M";
    case "27":
      return "F";
    case "30":
    case "33":
    case "34":
      return "E";
    default:
      return null;
  }
}
