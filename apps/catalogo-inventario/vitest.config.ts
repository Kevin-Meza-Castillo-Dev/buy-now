import { defineConfig } from "vitest/config";

// Pruebas unitarias: viven junto al código, en src/ y en scripts/.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    passWithNoTests: true,
  },
});
