const base = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const regx = /\D+/g;
const estr = "";
const types = ["M", "F", "E"] as const;

export type Type = typeof types[number];

/**
 * Returns true if input is a valid Argentine CUIT, false otherwise.
 * @param input string
 * @returns boolean
 */
export const is = (input: string): boolean => {
  const cuit = input.replace(regx, estr);
  if (cuit.length !== 11) return false;
  const d = 11 - (base.reduce((a, b, c) => a + ~~cuit[c] * b, 0) % 11);
  return ~~cuit[10] === (d === 11 ? 0 : d === 10 ? 0 : d);
};

/**
 * Try to guess a CUIT/CUIL from a given DNI
 * @param input string
 * @param type "M" | "F" | "E"
 * @returns string | null
 */
export const guess = (input: string, type: Type): string | null => {
  const dni = input.replace(regx, estr).padStart(8, "0");
  if (dni.length !== 8 || !types.includes(type)) return null;
  let xy = type === "F" ? "27" : type === "M" ? "20" : "30";
  const prefix = xy + dni;
  let z = base.reduce((a, b, c) => a + ~~prefix[c] * b, 0) % 11;
  if (z === 1) {
    if (type === "M") {
      z = 9;
      xy = "23";
    } else if (type === "F") {
      z = 4;
      xy = "23";
    }
  } else if (z !== 0) {
    z = 11 - z;
  }
  return [xy, dni, z].join("");
};

/**
 * Format a valid cuit
 * @param dirty string
 * @param separator string
 * @returns string
 * @throws
 */
export const format = (dirty: string, separator = "-"): string => {
  if (!is(dirty)) throw new Error(`Invalid cuit: ${dirty}`);
  const cuit = dirty.replace(regx, "");
  const a = cuit.slice(0, 2);
  const b = cuit.slice(2, -1);
  const c = cuit.slice(-1);
  return [a, b, c].join(separator);
};
