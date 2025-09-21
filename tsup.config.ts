import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/types.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  treeshake: true,
  // keep types-only subpath from emitting runtime by not exporting it in import/require
})
