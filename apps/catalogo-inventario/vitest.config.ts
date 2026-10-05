import { defineConfig } from "vitest/config";

// Pruebas unitarias: viven junto al código, en src/.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
