import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import * as cuit from "../src/index.ts";

/**
 * Runs every documented example of the form `fn(args); // result` in the README's code
 * blocks and in the JSDoc of src/index.ts, and checks the README's Types block against the
 * exported types, so the documentation cannot drift from the code.
 */

const root = join(import.meta.dir, "..");
const readme = await Bun.file(join(root, "README.md")).text();
const source = await Bun.file(join(root, "src/index.ts")).text();
const api = cuit as unknown as Record<string, (...args: unknown[]) => unknown>;

type Example = { where: string; fn: string; args: string; comment: string };

const CALL = /^(\w+)\((.*)\);?\s*\/\/\s*(.*)$/;

function examples(where: string, lines: string[]): Example[] {
  return lines.flatMap((line, i) => {
    const m = CALL.exec(line.trim());
    return m && m[1]! in api
      ? [{ where: `${where}:${i + 1}`, fn: m[1]!, args: m[2]!, comment: m[3]! }]
      : [];
  });
}

const readmeLines = readme.split("\n");
let inTsBlock = false;
const readmeCode = readmeLines.map((line) => {
  if (line.startsWith("```")) inTsBlock = line === "```typescript";
  return inTsBlock ? line : "";
});
const jsdocCode = source.split("\n").map((line) => line.replace(/^\s*\*\s?/, ""));

const all = [...examples("README.md", readmeCode), ...examples("src/index.ts", jsdocCode)];

/** The value a `// "..."`, `// true`, `// false` or `// null` comment documents. */
function documented(comment: string): { ok: true; value: unknown } | { ok: false } {
  const m = /^("(?:[^"\\]|\\.)*"|true|false|null)(?:\s|$)/.exec(comment);
  return m ? { ok: true, value: JSON.parse(m[1]!) } : { ok: false };
}

describe("documented examples", () => {
  test("there are examples to check", () => {
    expect(all.length).toBeGreaterThan(30);
  });

  test.each(all.map((e) => [`${e.where} ${e.fn}(${e.args})`, e] as const))(
    "%s",
    (_, e) => {
      const expected = documented(e.comment);
      if (!expected.ok) throw new Error(`${e.where}: no checkable result in "// ${e.comment}"`);
      const args = new Function(`return [${e.args}]`)() as unknown[];
      expect(api[e.fn]!(...args)).toBe(expected.value);
    },
  );
});

describe("README Types block", () => {
  test.each(["EntityType", "CuitPrefix"])("%s matches src/index.ts", (name) => {
    const pattern = new RegExp(`type ${name} = ([^;]+);`);
    const inReadme = pattern.exec(readme)?.[1];
    const inSource = pattern.exec(source)?.[1];
    expect(inSource).toBeDefined();
    expect(inReadme).toBe(inSource);
  });
});
