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
 */

/** Weights used in the check digit algorithm (mod 11) */
const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/** Valid entity types for CUIT generation */
export type EntityType = "M" | "F" | "E";

/** Valid CUIT prefixes */
export type CuitPrefix = "20" | "23" | "27" | "30";

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
    sum += parseInt(digits[i]!, 10) * WEIGHTS[i]!;
  }
  return sum;
}

/**
 * Computes the expected check digit from the weighted sum remainder.
 */
function computeCheckDigit(remainder: number): number {
  return remainder === 0 ? 0 : remainder === 1 ? 0 : 11 - remainder;
}

/**
 * Validates whether a CUIT is valid.
 *
 * @example
 * ```ts
 * isValid("20-12345678-9") // true or false
 * isValid("20123456789")   // also works without separators
 * ```
 */
export function isValid(input: string): boolean {
  const cuit = normalize(input);
  if (cuit.length !== 11) return false;

  const expected = computeCheckDigit(computeSum(cuit) % 11);
  const actual = parseInt(cuit[10]!, 10);

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
 * generate("12345678", "M") // "20123456785"
 * generate("12345678", "F") // "27123456780"
 * generate("12345678", "E") // "30123456780"
 * ```
 */
export function generate(dni: string, type: EntityType): string {
  if (type !== "M" && type !== "F" && type !== "E") return "";

  const body = normalize(dni).padStart(8, "0").slice(0, 8);
  let prefix: CuitPrefix = type === "F" ? "27" : type === "M" ? "20" : "30";

  let checkDigit = computeSum(prefix + body) % 11;

  // Handle special case where check digit would be 1 (invalid)
  if (checkDigit === 1) {
    if (type === "M") {
      prefix = "23";
      checkDigit = 9;
    } else if (type === "F") {
      prefix = "23";
      checkDigit = 4;
    } else {
      checkDigit = 0;
    }
  } else if (checkDigit !== 0) {
    checkDigit = 11 - checkDigit;
  }

  return `${prefix}${body}${checkDigit}`;
}

/**
 * Formats a CUIT with the specified separator.
 *
 * @example
 * ```ts
 * format("20123456789")      // "20-12345678-9"
 * format("20123456789", "/") // "20/12345678/9"
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
 * getPrefix("20-12345678-9") // "20"
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
 * getDni("20-12345678-9") // "12345678"
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
 * getCheckDigit("20-12345678-9") // "9"
 * ```
 */
export function getCheckDigit(input: string): string {
  return pad(input).slice(10);
}

/**
 * Determines the entity type from a CUIT prefix.
 *
 * @returns The entity type, or `null` if unknown prefix
 *
 * @example
 * ```ts
 * getEntityType("20-12345678-9") // "M"
 * getEntityType("27-12345678-9") // "F"
 * getEntityType("30-12345678-9") // "E"
 * ```
 */
export function getEntityType(input: string): EntityType | null {
  switch (getPrefix(input)) {
    case "20":
    case "23":
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
