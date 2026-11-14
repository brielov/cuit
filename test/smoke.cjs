// Loads the built CommonJS entry with plain Node (CI runs this on the minimum supported version).
const assert = require("node:assert");
const cuit = require("../dist/index.cjs");

assert.strictEqual(cuit.isValid("20-12345678-6"), true);
assert.strictEqual(cuit.generate("69345023", "E"), "33693450239");
assert.strictEqual(cuit.getEntityType("23-10000002-4"), "F");
console.log(`CJS build OK on Node ${process.version}`);
