import { expect } from "jsr:@std/expect";
import { describe, it } from "jsr:@std/testing/bdd";
import cuits from "./cuits.json" with { type: "json" };
import {
  type CUIT,
  formatCuit,
  Gender,
  guessCuit,
  validateCuit,
} from "./mod.ts";

describe("validateCuit", () => {
  it("should return a valid CUIT for each entry", () => {
    cuits.forEach((cuit: string) => {
      const actual = validateCuit(cuit);

      expect(actual).not.toBe(null);
      expect(actual).toMatch(/^\d{2}\d{8}\d{1}$/);
    });
  });

  it("should reject invalid CUITs", () => {
    const invalidCuit = "123-456-789";
    const result = validateCuit(invalidCuit);
    expect(result).toBe(null);
  });
});

describe("formatCuit", () => {
  it("should format CUIT correctly with default separator", () => {
    cuits.forEach((cuit) => {
      const actual = formatCuit(cuit as CUIT);
      const expected = `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${
        cuit.slice(10)
      }`;
      expect(actual).toEqual(expected);
    });
  });

  it("should format CUIT correctly with custom separator", () => {
    cuits.forEach((cuit) => {
      const actual = formatCuit(cuit as CUIT, ".");
      const expected = `${cuit.slice(0, 2)}.${cuit.slice(2, 10)}.${
        cuit.slice(10)
      }`;
      expect(actual).toEqual(expected);
    });
  });
});

describe("guessCuit", () => {
  it("should guess the CUIT for a male celebrity", () => {
    const dni = "11299750"; // Example DNI for a male celebrity
    const type = Gender.Male; // Male type
    const expectedCuit = "20112997505"; // Hypothetical CUIT for the given DNI

    const guessedCuit = guessCuit(dni, type);
    expect(guessedCuit).toBe(expectedCuit); // Validate the guess
  });

  it("should guess the CUIT for a female celebrity", () => {
    const dni = "04845350"; // Example DNI for a female celebrity
    const type = Gender.Female; // Female type
    const expectedCuit = "27048453509"; // Hypothetical CUIT for the given DNI

    const guessedCuit = guessCuit(dni, type);
    expect(guessedCuit).toBe(expectedCuit); // Validate the guess
  });
});
