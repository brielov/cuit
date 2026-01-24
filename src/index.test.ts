import { describe, expect, test } from "bun:test";
import {
  isValid,
  generate,
  format,
  normalize,
  getPrefix,
  getDni,
  getCheckDigit,
  getEntityType,
  type EntityType,
} from "./index.ts";

describe("normalize", () => {
  test("removes hyphens", () => {
    expect(normalize("20-12345678-9")).toBe("20123456789");
  });

  test("removes slashes", () => {
    expect(normalize("20/12345678/9")).toBe("20123456789");
  });

  test("removes spaces", () => {
    expect(normalize("20 12345678 9")).toBe("20123456789");
  });

  test("removes dots", () => {
    expect(normalize("20.12345678.9")).toBe("20123456789");
  });

  test("handles mixed separators", () => {
    expect(normalize("20-12.345 678/9")).toBe("20123456789");
  });

  test("returns empty string for non-numeric input", () => {
    expect(normalize("abcdefghijk")).toBe("");
  });

  test("returns same string if already normalized", () => {
    expect(normalize("20123456789")).toBe("20123456789");
  });

  test("handles empty string", () => {
    expect(normalize("")).toBe("");
  });
});

describe("generate", () => {
  describe("male CUITs", () => {
    test("generates valid CUIT with prefix 20 for males", () => {
      const cuit = generate("12345678", "M");
      expect(getPrefix(cuit)).toBe("20");
      expect(isValid(cuit)).toBe(true);
    });

    test("handles DNI with separators", () => {
      const cuitWithDots = generate("12.345.678", "M");
      const cuitWithoutDots = generate("12345678", "M");
      expect(cuitWithDots).toBe(cuitWithoutDots);
    });

    test("handles short DNI (pads with zeros)", () => {
      const cuit = generate("1234567", "M");
      expect(getDni(cuit)).toBe("01234567");
      expect(isValid(cuit)).toBe(true);
    });

    test("handles very short DNI", () => {
      const cuit = generate("123", "M");
      expect(getDni(cuit)).toBe("00000123");
      expect(isValid(cuit)).toBe(true);
    });

    test("handles long DNI (truncates to 8 digits)", () => {
      const cuit = generate("123456789", "M");
      expect(getDni(cuit)).toBe("12345678");
      expect(isValid(cuit)).toBe(true);
    });
  });

  describe("female CUITs", () => {
    test("generates valid CUIT with prefix 27 for females", () => {
      const cuit = generate("12345678", "F");
      expect(getPrefix(cuit)).toBe("27");
      expect(isValid(cuit)).toBe(true);
    });

    test("generates different CUIT than male for same DNI", () => {
      const maleCuit = generate("12345678", "M");
      const femaleCuit = generate("12345678", "F");
      expect(maleCuit).not.toBe(femaleCuit);
    });
  });

  describe("entity CUITs", () => {
    test("generates valid CUIT with prefix 30 for entities", () => {
      const cuit = generate("12345678", "E");
      expect(getPrefix(cuit)).toBe("30");
      expect(isValid(cuit)).toBe(true);
    });
  });

  describe("special case prefix 23", () => {
    // The algorithm uses prefix 23 when the check digit would be 1
    // We need to find DNIs that trigger this condition
    test("uses prefix 23 for males when check digit would be invalid", () => {
      // Iterate to find a DNI that triggers the special case
      let found = false;
      for (let i = 10000000; i < 99999999 && !found; i += 100000) {
        const dni = String(i);
        const cuit = generate(dni, "M");
        if (getPrefix(cuit) === "23") {
          expect(isValid(cuit)).toBe(true);
          found = true;
        }
      }
      expect(found).toBe(true);
    });

    test("uses prefix 23 for females when check digit would be invalid", () => {
      let found = false;
      for (let i = 10000000; i < 99999999 && !found; i += 100000) {
        const dni = String(i);
        const cuit = generate(dni, "F");
        if (getPrefix(cuit) === "23") {
          expect(isValid(cuit)).toBe(true);
          found = true;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("returns empty string for invalid type", () => {
      expect(generate("12345678", "X" as EntityType)).toBe("");
    });

    test("handles empty DNI", () => {
      const cuit = generate("", "M");
      expect(getDni(cuit)).toBe("00000000");
      expect(isValid(cuit)).toBe(true);
    });

    test("handles DNI with only separators", () => {
      const cuit = generate("---", "M");
      expect(getDni(cuit)).toBe("00000000");
      expect(isValid(cuit)).toBe(true);
    });

    test("all generated CUITs are valid", () => {
      // Test a range of DNIs
      for (let i = 0; i < 100; i++) {
        const dni = String(i * 100000);
        expect(isValid(generate(dni, "M"))).toBe(true);
        expect(isValid(generate(dni, "F"))).toBe(true);
        expect(isValid(generate(dni, "E"))).toBe(true);
      }
    });
  });
});

describe("isValid", () => {
  describe("validates generated CUITs", () => {
    test("validates male CUITs", () => {
      const cuit = generate("12345678", "M");
      expect(isValid(cuit)).toBe(true);
    });

    test("validates female CUITs", () => {
      const cuit = generate("12345678", "F");
      expect(isValid(cuit)).toBe(true);
    });

    test("validates entity CUITs", () => {
      const cuit = generate("12345678", "E");
      expect(isValid(cuit)).toBe(true);
    });

    test("validates CUITs with different separators", () => {
      const cuit = generate("12345678", "M");
      const formatted = format(cuit, "-");
      expect(isValid(formatted)).toBe(true);
      expect(isValid(format(cuit, "/"))).toBe(true);
      expect(isValid(format(cuit, " "))).toBe(true);
      expect(isValid(format(cuit, "."))).toBe(true);
    });
  });

  describe("rejects invalid CUITs", () => {
    test("returns false when check digit is wrong", () => {
      const validCuit = generate("12345678", "M");
      // Change the last digit
      const lastDigit = parseInt(validCuit.slice(-1));
      const wrongDigit = (lastDigit + 1) % 10;
      const invalidCuit = validCuit.slice(0, -1) + wrongDigit;
      expect(isValid(invalidCuit)).toBe(false);
    });

    test("returns false for too short input", () => {
      expect(isValid("2012345678")).toBe(false);
      expect(isValid("123456789")).toBe(false);
      expect(isValid("")).toBe(false);
    });

    test("returns false for too long input", () => {
      expect(isValid("201234567890")).toBe(false);
      expect(isValid("2012345678901")).toBe(false);
    });

    test("returns false for non-numeric input", () => {
      expect(isValid("abcdefghijk")).toBe(false);
    });

    test("returns false for partially numeric input", () => {
      expect(isValid("20-abcdefgh-9")).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("validates CUIT with all zeros DNI", () => {
      const cuit = generate("00000000", "M");
      expect(isValid(cuit)).toBe(true);
    });

    test("validates CUIT with maximum DNI", () => {
      const cuit = generate("99999999", "M");
      expect(isValid(cuit)).toBe(true);
    });
  });
});

describe("format", () => {
  test("formats with default separator (hyphen)", () => {
    const cuit = generate("12345678", "M");
    const formatted = format(cuit);
    expect(formatted).toMatch(/^\d{2}-\d{8}-\d$/);
  });

  test("formats with custom separator", () => {
    const cuit = generate("12345678", "M");
    expect(format(cuit, "/")).toMatch(/^\d{2}\/\d{8}\/\d$/);
    expect(format(cuit, " ")).toMatch(/^\d{2} \d{8} \d$/);
    expect(format(cuit, ".")).toMatch(/^\d{2}\.\d{8}\.\d$/);
  });

  test("formats with empty separator", () => {
    const cuit = generate("12345678", "M");
    expect(format(cuit, "")).toMatch(/^\d{11}$/);
    expect(format(cuit, "")).toBe(cuit);
  });

  test("handles already formatted input", () => {
    const cuit = generate("12345678", "M");
    const formatted = format(cuit);
    expect(format(formatted)).toBe(formatted);
  });

  test("pads short input with zeros", () => {
    expect(format("123456789")).toBe("00-12345678-9");
    expect(format("12345")).toBe("00-00001234-5");
  });

  test("truncates long input", () => {
    expect(format("201234567890")).toBe("20-12345678-9");
  });

  test("handles empty input", () => {
    expect(format("")).toBe("00-00000000-0");
  });

  test("reformats input with mixed separators", () => {
    const cuit = generate("12345678", "M");
    const mixedFormat = format(cuit, "/");
    expect(format(mixedFormat)).toBe(format(cuit));
  });
});

describe("getPrefix", () => {
  test("extracts prefix from generated CUITs", () => {
    expect(getPrefix(generate("12345678", "M"))).toMatch(/^(20|23)$/);
    expect(getPrefix(generate("12345678", "F"))).toMatch(/^(27|23)$/);
    expect(getPrefix(generate("12345678", "E"))).toBe("30");
  });

  test("extracts prefix from formatted CUIT", () => {
    const cuit = generate("12345678", "M");
    const formatted = format(cuit);
    expect(getPrefix(formatted)).toBe(getPrefix(cuit));
  });

  test("pads short input", () => {
    expect(getPrefix("123456789")).toBe("00");
  });

  test("handles empty input", () => {
    expect(getPrefix("")).toBe("00");
  });
});

describe("getDni", () => {
  test("extracts DNI from generated CUIT", () => {
    const cuit = generate("12345678", "M");
    expect(getDni(cuit)).toBe("12345678");
  });

  test("extracts padded DNI", () => {
    const cuit = generate("123", "M");
    expect(getDni(cuit)).toBe("00000123");
  });

  test("extracts DNI from formatted CUIT", () => {
    const cuit = generate("12345678", "M");
    const formatted = format(cuit);
    expect(getDni(formatted)).toBe("12345678");
  });

  test("handles short input", () => {
    expect(getDni("123456789")).toBe("12345678");
  });

  test("handles empty input", () => {
    expect(getDni("")).toBe("00000000");
  });
});

describe("getCheckDigit", () => {
  test("extracts check digit from generated CUIT", () => {
    const cuit = generate("12345678", "M");
    const checkDigit = getCheckDigit(cuit);
    expect(checkDigit).toMatch(/^\d$/);
    expect(cuit.endsWith(checkDigit)).toBe(true);
  });

  test("extracts check digit from formatted CUIT", () => {
    const cuit = generate("12345678", "M");
    const formatted = format(cuit);
    expect(getCheckDigit(formatted)).toBe(getCheckDigit(cuit));
  });

  test("handles short input", () => {
    expect(getCheckDigit("123456789")).toBe("9");
  });

  test("handles empty input", () => {
    expect(getCheckDigit("")).toBe("0");
  });
});

describe("getEntityType", () => {
  test("returns M for prefix 20", () => {
    // Generate a male CUIT and check entity type
    const cuit = generate("12345678", "M");
    if (getPrefix(cuit) === "20") {
      expect(getEntityType(cuit)).toBe("M");
    }
  });

  test("returns M for prefix 23", () => {
    expect(getEntityType("23-12345678-9")).toBe("M");
  });

  test("returns M for prefix 24", () => {
    expect(getEntityType("24-12345678-9")).toBe("M");
  });

  test("returns F for prefix 27", () => {
    expect(getEntityType("27-12345678-9")).toBe("F");
  });

  test("returns E for prefix 30", () => {
    expect(getEntityType("30-12345678-9")).toBe("E");
  });

  test("returns E for prefix 33", () => {
    expect(getEntityType("33-12345678-9")).toBe("E");
  });

  test("returns E for prefix 34", () => {
    expect(getEntityType("34-12345678-9")).toBe("E");
  });

  test("returns null for unknown prefix", () => {
    expect(getEntityType("99-12345678-9")).toBeNull();
    expect(getEntityType("11-12345678-9")).toBeNull();
    expect(getEntityType("00-12345678-9")).toBeNull();
  });

  test("correctly identifies generated CUITs", () => {
    const maleCuit = generate("12345678", "M");
    const femaleCuit = generate("12345678", "F");
    const entityCuit = generate("12345678", "E");

    // Male CUITs have prefix 20 or 23
    expect(["M"].includes(getEntityType(maleCuit)!)).toBe(true);
    // Female CUITs have prefix 27 or 23, but we return M for 23 by default
    const femaleType = getEntityType(femaleCuit);
    expect(femaleType === "F" || femaleType === "M").toBe(true);
    // Entity CUITs have prefix 30
    expect(getEntityType(entityCuit)).toBe("E");
  });
});

describe("integration tests", () => {
  test("generate then validate round-trip", () => {
    const dni = "12345678";
    const types: EntityType[] = ["M", "F", "E"];

    for (const type of types) {
      const cuit = generate(dni, type);
      expect(isValid(cuit)).toBe(true);
    }
  });

  test("format then validate", () => {
    const cuit = generate("12345678", "M");
    const formatted = format(cuit);
    expect(isValid(formatted)).toBe(true);
  });

  test("extract parts then reconstruct", () => {
    const cuit = generate("12345678", "M");
    const prefix = getPrefix(cuit);
    const dni = getDni(cuit);
    const checkDigit = getCheckDigit(cuit);

    const reconstructed = `${prefix}${dni}${checkDigit}`;
    expect(reconstructed).toBe(cuit);
  });

  test("generate then extract DNI", () => {
    const dni = "12345678";
    const cuit = generate(dni, "M");
    expect(getDni(cuit)).toBe(dni);
  });

  test("format preserves validity", () => {
    const separators = ["-", "/", " ", ".", ""];
    const cuit = generate("12345678", "M");

    for (const sep of separators) {
      const formatted = format(cuit, sep);
      expect(isValid(formatted)).toBe(true);
    }
  });

  test("consistent behavior across many DNIs", () => {
    // Test 1000 different DNIs
    for (let i = 10000000; i < 10001000; i++) {
      const dni = String(i);
      const maleCuit = generate(dni, "M");
      const femaleCuit = generate(dni, "F");
      const entityCuit = generate(dni, "E");

      // All should be valid
      expect(isValid(maleCuit)).toBe(true);
      expect(isValid(femaleCuit)).toBe(true);
      expect(isValid(entityCuit)).toBe(true);

      // DNI should be extractable
      expect(getDni(maleCuit)).toBe(dni);
      expect(getDni(femaleCuit)).toBe(dni);
      expect(getDni(entityCuit)).toBe(dni);
    }
  });
});

describe("performance", () => {
  test("validates 10000 CUITs quickly", () => {
    const cuit = generate("12345678", "M");
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      isValid(cuit);
    }
    const duration = performance.now() - start;
    // Should complete in under 100ms
    expect(duration).toBeLessThan(100);
  });

  test("generates 10000 CUITs quickly", () => {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      generate("12345678", "M");
    }
    const duration = performance.now() - start;
    // Should complete in under 100ms
    expect(duration).toBeLessThan(100);
  });
});

describe("known valid CUITs (real-world)", () => {
  // Real CUITs from major Argentine companies (source: constanciacuit.com)
  const REAL_COMPANY_CUITS = [
    "30500006613", // YPF
    "30663205621", // Mercado Libre
    "30500057102", // Telecom Argentina
    "30678561165",
    "30604958640",
    "30704961983",
    "30500031960",
    "30504018845",
    "30685376349",
    "30562113289",
    "34500045339",
    "30500051546",
    "30500530851",
    "30546689979",
    "30666074013",
    "30715491156",
    "30711655197",
    "34999032089",
    "30500010084",
    "30710404611",
    "30999228565",
    "30692296377",
    "30685029959",
    "30695542476",
    "30661876715",
    "30678186445",
    "30999027489",
    "30502793175",
    "30525718626",
    "30663173576",
    "30649076576",
    "30627393713",
    "30686955180",
    "30547339416",
    "33546700939",
    "30532708059",
    "30546741253",
    "30500009442",
    "30715793217",
    "30699408154",
    "30546666561",
    "30999004217",
    "30704962807",
    "30546660385",
    "33707995519",
    "30546676591",
    "30709872156",
    "30689904390",
    "30628540787",
    "30546663422",
    "30500001735",
    "30500003193",
    "30500008454",
    "30580189411",
    "30709447846",
    "33537186009",
    "30583602409",
    "30574816870",
    "30641405554",
    "30655116202",
    "30655116512",
    "30657877669",
    "30678814357",
    "30709565075",
    "33687309109",
    "30539187658",
    "30536216584",
    "30683032227",
    "30550273558",
    "30558325557",
    "30677883096",
    "30610252334",
    "30714912689",
    "30500011072",
    "33999242109",
    "30999032083",
    "30679065382",
    "30999270111",
    "30685578413",
    "30546771314",
    "30500089624",
    "30689133483",
    "30685228501",
    "30522428163",
    "30500056661",
    "30500037217",
    "30500049460",
    "30714438537",
    "30500010912",
    "33707366589",
    "30500036911",
    "33679139369",
    "30678519681",
    "30537899901",
    "30500005625",
    "30598910045",
    "33693450239",
  ];

  test.each(REAL_COMPANY_CUITS)("validates real company CUIT: %s", (cuit) => {
    expect(isValid(cuit)).toBe(true);
  });

  test("all real CUITs have entity prefixes", () => {
    for (const cuit of REAL_COMPANY_CUITS) {
      const prefix = getPrefix(cuit);
      expect(["30", "33", "34"].includes(prefix)).toBe(true);
      expect(getEntityType(cuit)).toBe("E");
    }
  });

  // AFIP's CUIT is publicly known
  test("validates AFIP CUIT", () => {
    expect(isValid("33-69345023-9")).toBe(true);
  });
});

describe("algorithm verification", () => {
  // Verify the check digit calculation matches the original algorithm
  test("check digit calculation is correct", () => {
    // The algorithm uses weights [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    // and calculates: 11 - (sum % 11)
    // with special cases for 11 and 10 (both become 0)

    // Generate CUITs and verify they validate
    const testDnis = [
      "00000000",
      "11111111",
      "22222222",
      "33333333",
      "44444444",
      "55555555",
      "66666666",
      "77777777",
      "88888888",
      "99999999",
      "12345678",
      "87654321",
      "10000000",
      "01000000",
      "00100000",
      "00010000",
      "00001000",
      "00000100",
      "00000010",
      "00000001",
    ];

    for (const dni of testDnis) {
      const maleCuit = generate(dni, "M");
      const femaleCuit = generate(dni, "F");
      const entityCuit = generate(dni, "E");

      expect(isValid(maleCuit)).toBe(true);
      expect(isValid(femaleCuit)).toBe(true);
      expect(isValid(entityCuit)).toBe(true);
    }
  });
});
