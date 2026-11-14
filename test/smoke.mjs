// Loads the built ES module entry with plain Node (CI runs this on the minimum supported version).
import assert from "node:assert";
import { generate, getEntityType, isValid } from "../dist/index.js";

assert.strictEqual(isValid("20-12345678-6"), true);
assert.strictEqual(generate("69345023", "E"), "33693450239");
assert.strictEqual(getEntityType("23-10000002-4"), "F");
console.log(`ESM build OK on Node ${process.version}`);
