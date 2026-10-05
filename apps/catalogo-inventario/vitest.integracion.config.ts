import { defineConfig } from "vitest/config";

// Pruebas de integración: van contra el Postgres de DATABASE_URL y comparten la base,
// así que los archivos corren uno tras otro.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
  },
});
