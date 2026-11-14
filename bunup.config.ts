import { defineConfig } from "bunup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  // Platform-neutral output: the default "node" target makes the CJS build
  // require("node:module"), which browser bundlers cannot resolve.
  target: "browser",
  dts: true,
  clean: true,
  minify: true,
});
