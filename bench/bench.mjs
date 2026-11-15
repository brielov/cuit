// Benchmarks for the built package (what consumers run). Usage:
//   bun run build && node bench/bench.mjs [filter] && bun bench/bench.mjs [filter]
// CUIT_DIST=<path to an index.js> benchmarks another build (e.g. an older commit).
// Prints one line per workload: p50, p75 and p99 per operation.
import { pathToFileURL } from "node:url";
import { bench, do_not_optimize, run } from "mitata";

const cuit = await import(
  process.env.CUIT_DIST ? pathToFileURL(process.env.CUIT_DIST).href : "../dist/index.js"
);

const { isValid, generate, format, getEntityType, getPrefix, getDni, getCheckDigit, normalize } =
  cuit;

// Deterministic inputs (LCG), rotated through so the JIT cannot fold a single constant.
let seed = 12345;
const rand = (n) => ((seed = (seed * 1103515245 + 12345) >>> 0) % n);
const N = 1024;
const MASK = N - 1;
const dni = () => String(10_000_000 + rand(90_000_000));
const TYPES = ["M", "F", "E"];
// Flatten strings: real input arrives flat, while template literals and concatenation make
// V8 cons-strings, which are slower to read
const enc = new TextEncoder();
const dec = new TextDecoder();
const flat = (s) => dec.decode(enc.encode(s));
const VALID = Array.from({ length: N }, () => flat(generate(dni(), TYPES[rand(3)])));
const FORMATTED = VALID.map((c) => flat(format(c)));
const NBSP = VALID.map((c) => flat(format(c, "\u00a0")));
const BAD_CHECK = VALID.map((c) => flat(c.slice(0, 10) + ((Number(c[10]) + 1) % 10)));
const GARBAGE = Array.from({ length: N }, (_, i) => `CUIT ${i}: n/a`);
const DNIS = Array.from({ length: N }, dni);
const DOTTED_DNIS = DNIS.map((d) => flat(`${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`));

// Bulk: 10k mixed values as they arrive from a form or CSV column
const MIXED = Array.from({ length: 10_000 }, (_, i) => {
  const c = VALID[i & MASK];
  switch (i % 5) {
    case 0: return c;
    case 1: return flat(format(c));
    case 2: return flat(format(c, " "));
    case 3: return BAD_CHECK[i & MASK];
    default: return GARBAGE[i & MASK];
  }
});

let i = 0;
const next = () => i++ & MASK;

const workloads = {
  "isValid formatted (valid)": () => isValid(FORMATTED[next()]),
  "isValid plain (valid)": () => isValid(VALID[next()]),
  "isValid wrong check digit": () => isValid(BAD_CHECK[next()]),
  "isValid garbage": () => isValid(GARBAGE[next()]),
  "isValid NBSP-separated": () => isValid(NBSP[next()]),
  "generate": () => generate(DNIS[next()], TYPES[i % 3]),
  "generate dotted DNI": () => generate(DOTTED_DNIS[next()], TYPES[i % 3]),
  "format": () => format(VALID[next()]),
  "normalize formatted": () => normalize(FORMATTED[next()]),
  "getEntityType formatted": () => getEntityType(FORMATTED[next()]),
  "getters plain": () => {
    const s = VALID[next()];
    return getPrefix(s) + getDni(s) + getCheckDigit(s);
  },
  "getters (prefix+dni+check)": () => {
    const s = FORMATTED[next()];
    return getPrefix(s) + getDni(s) + getCheckDigit(s);
  },
  "isValid bulk 10k mixed": () => {
    let n = 0;
    for (let k = 0; k < MIXED.length; k++) n += isValid(MIXED[k]) ? 1 : 0;
    return n;
  },
};

// Scaling: oversized input (a pasted blob). Linear growth expected. Run each in its own
// process (bench/scale.sh) so one workload's JIT state does not distort the next.
for (const len of [100_000, 200_000, 400_000, 800_000]) {
  const digits = "1".repeat(len);
  const tailLetter = "1".repeat(len - 1) + "x";
  const separators = "20-12345678-6" + " -".repeat((len - 13) / 2);
  workloads[`scale isValid digits ${len / 1000}k`] = () => isValid(digits);
  workloads[`scale isValid letter-at-end ${len / 1000}k`] = () => isValid(tailLetter);
  workloads[`scale isValid separators ${len / 1000}k`] = () => isValid(separators);
  const ideographic = "20" + "\u3000".repeat(len - 11) + "123456786";
  workloads[`scale isValid U+3000 ${len / 1000}k`] = () => isValid(ideographic);
  workloads[`scale format digits ${len / 1000}k`] = () => format(digits);
}

const filter = new RegExp(process.argv[2] ?? ".");
for (const [name, fn] of Object.entries(workloads)) {
  // Read one character of string results: Bun (and V8 for 13+ characters) builds
  // concatenations and slices lazily, and the first read pays to flatten them.
  if (filter.test(name)) {
    bench(name, () => {
      const r = fn();
      do_not_optimize(typeof r === "string" ? r.charCodeAt(r.length >> 1) : r);
    });
  }
}

const runtime = typeof Bun !== "undefined" ? `bun ${Bun.version}` : `node ${process.version}`;
const { benchmarks } = await run({ format: "quiet" });
console.log(`# ${runtime}`);
for (const b of benchmarks) {
  const s = b.runs[0].stats;
  const fmt = (ns) => (ns >= 1e6 ? `${(ns / 1e6).toFixed(2)} ms` : ns >= 1e3 ? `${(ns / 1e3).toFixed(2)} µs` : `${ns.toFixed(1)} ns`);
  console.log(`${b.alias.padEnd(34)} p50 ${fmt(s.p50).padStart(10)}  p75 ${fmt(s.p75).padStart(10)}  p99 ${fmt(s.p99).padStart(10)}`);
}
