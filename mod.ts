export type CUIT = string & { _tag: "cuit" };

const BASE_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const CUIT_REGEX = /^\d{2}\d{8}\d{1}$/;

/**
 * Validates and sanitizes an Argentine CUIT.
 * @param input The CUIT string to validate.
 * @returns A sanitized CUIT if valid, otherwise null.
 */
export const validateCuit = (input: string): CUIT | null => {
  // Remove non-numeric characters
  const cuit = input.replace(/\D/g, "");
  if (!CUIT_REGEX.test(cuit) || cuit.length !== 11) return null;

  const checksum = BASE_WEIGHTS.reduce(
    (sum, weight, index) => sum + weight * +cuit[index],
    0,
  );
  const checkDigit = 11 - (checksum % 11);
  const validDigit = checkDigit === 11 ? 0 : checkDigit === 10 ? 9 : checkDigit;

  return +cuit[10] === validDigit ? (cuit as CUIT) : null;
};

/**
 * Formats a validated CUIT to a custom format.
 * @param cuit The sanitized and validated CUIT string.
 * @param separator The separator to use between CUIT parts (default is "-").
 * @returns The formatted CUIT string.
 */
export const formatCuit = (cuit: CUIT, separator: string = "-"): string => {
  return `${cuit.slice(0, 2)}${separator}${cuit.slice(2, 10)}${separator}${
    cuit.slice(10)
  }`;
};

export enum Gender {
  Male,
  Female,
}

/**
 * Try to guess a CUIT/CUIL from a given DNI.
 * @param dniInput The DNI string to process.
 * @param gender The type of CUIT (CuitType.Male, CuitType.Female, or CuitType.Entity).
 * @returns A guessed CUIT string in the format XX-XXXXXXXX-X.
 */
export const guessCuit = (dniInput: string, gender: Gender): string => {
  // Sanitize the DNI input to remove non-digit characters and pad to 8 digits
  const sanitizedDni = dniInput.replace(/\D/g, "").padStart(8, "0").slice(0, 8);

  // Determine the prefix based on the type (XY digits)
  let prefix = gender === Gender.Female ? "27" : "20";

  // Concatenate prefix and DNI
  const partialCuit = prefix + sanitizedDni;

  // Calculate the checksum (verification digit)
  let checksum = BASE_WEIGHTS.reduce(
    (sum, weight, index) => sum + +partialCuit[index] * weight,
    0,
  ) % 11;

  // Adjust for special cases where checksum equals 1
  if (checksum === 1) {
    if (gender === Gender.Male) {
      checksum = 9;
      prefix = "23"; // Change prefix for male
    } else if (gender === Gender.Female) {
      checksum = 4;
      prefix = "23"; // Change prefix for female
    }
  } else if (checksum !== 0) {
    checksum = 11 - checksum;
  }

  // Construct the final CUIT
  return `${prefix}${sanitizedDni}${checksum}`;
};
