import { defineConfig } from "drizzle-kit";

// Solo para generar migraciones a partir del esquema. Aplicarlas es cosa de src/db/migrar.ts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/esquema.ts",
  out: "./migraciones",
});
