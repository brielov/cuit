import { Type, format, guess, is } from "./cuit";

const valid: [string, Type][] = [
  ["20-22432311-6", "M"],
  ["20-21834641-4", "M"],
  ["23-14623375-9", "M"],
  ["27-11988336-4", "F"],
  ["23-12522145-9", "M"],
  ["30-70308853-4", "E"],
  ["20-28052206-7", "M"],
  ["20-24752854-8", "M"],
  ["30-51757696-0", "E"],
  ["20-34188025-5", "M"],
  ["27-11403406-7", "F"],
];

const invalid = valid.map(flipLastDigit);

function flipLastDigit([cuit, type]: [string, Type]): [string, Type] {
  const [a, b, c] = cuit.split("-");
  const n = 11 - Number(c);
  return [[a, b, n].join("-"), type];
}

describe.each(valid)('.is("%s")', (cuit) =>
  test("returns true", () => expect(is(cuit)).toBe(true)),
);

describe.each(invalid)('.is("%s")', (cuit) =>
  test("returns false", () => expect(is(cuit)).toBe(false)),
);

describe.each(valid)('.guess("%s", "%s")', (cuit, type) => {
  const [, dni] = cuit.split("-");
  test("guesses correctly", () =>
    expect(guess(dni, type)).toEqual(cuit.replace(/-/g, "")));
});

describe('.guess("7507882", "M")', () => {
  it("handles 7-digit dni", () => {
    expect(guess("7507882", "M")).toEqual("20075078820");
  });
});

describe(".format()", () => {
  it("throws error when cuit is invalid", () => {
    expect(() => format(invalid[0][0])).toThrow(/invalid cuit/i);
  });

  it("returns a formatted cuit", () => {
    expect(format("20224323116")).toEqual("20-22432311-6");
  });

  it("returns a formatted cuit using custom separator", () => {
    expect(format("20-22432311-6", ".")).toEqual("20.22432311.6");
  });
});
