import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  clean: true,
  sourcemap: true,
  platform: "node",
  target: "node22",
  outDir: "dist",
  treeshake: true,
  splitting: false,
  dts: true,
  onSuccess: async () => {
    console.log("Build completed successfully!");
  },
});
