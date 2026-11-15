import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import * as source from "../src/index.ts";

/** Checks what consumers actually install: the built ESM and CJS files and their types. */

const root = join(import.meta.dir, "..");
const pkg = await Bun.file(join(root, "package.json")).json();
const sourceExports = Object.keys(source).sort();

beforeAll(() => {
  const build = Bun.spawnSync(["bun", "run", "build"], { cwd: root, stdout: "ignore" });
  expect(build.exitCode).toBe(0);
});

/**
 * Gzipped size limits in bytes. Small size is part of what the package offers: a change that
 * needs more must raise these on purpose, and say why. Measured with Bun.gzipSync at level 9.
 */
const GZIP_BUDGET = { "dist/index.js": 600, "dist/index.cjs": 900 };

describe("built package", () => {
  test.each(Object.entries(GZIP_BUDGET))(
    "%s stays within %d bytes gzipped",
    async (file, budget) => {
      const bytes = await Bun.file(join(root, file)).bytes();
      expect(Bun.gzipSync(bytes, { level: 9 }).length).toBeLessThanOrEqual(budget);
    },
  );

  test("every path in package.json exports and main/module/types exists", () => {
    const paths = [
      pkg.main,
      pkg.module,
      pkg.types,
      ...Object.values(pkg.exports["."].import),
      ...Object.values(pkg.exports["."].require),
    ] as string[];
    for (const path of paths) expect(existsSync(join(root, path))).toBe(true);
  });

  test.each(["dist/index.js", "dist/index.cjs"])(
    "%s imports nothing, so it runs in Node, browsers and edge runtimes",
    async (file) => {
      const code = await Bun.file(join(root, file)).text();
      expect(code).not.toMatch(/\brequire\s*\(/);
      expect(code).not.toMatch(/\bimport\s*[("'{*]|\bfrom\s*["']/);
    },
  );

  test("the CJS build exports the same API as the source", () => {
    const cjs = createRequire(import.meta.url)(join(root, pkg.exports["."].require.default));
    expect(Object.keys(cjs).sort()).toEqual(sourceExports);
    expect(cjs.isValid("20-12345678-6")).toBe(true);
    expect(cjs.generate("69345023", "E")).toBe("33693450239");
  });

  test("the ESM build exports the same API as the source", async () => {
    const esm = await import(join(root, pkg.exports["."].import.default));
    expect(Object.keys(esm).sort()).toEqual(sourceExports);
    expect(esm.isValid("20-12345678-6")).toBe(true);
    expect(esm.generate("69345023", "E")).toBe("33693450239");
  });
});
