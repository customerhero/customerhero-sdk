import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", preview: "src/preview.tsx" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["react", "react/jsx-runtime", "@customerhero/js"],
});
