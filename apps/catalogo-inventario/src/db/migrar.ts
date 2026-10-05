import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const CARPETA = fileURLToPath(new URL("../../migraciones", import.meta.url));

// Aplica las migraciones pendientes del esquema `inventario`. El registro de las ya
// aplicadas vive en el mismo esquema, porque la base se comparte con `pedidos` y cada
// servicio migra solo el suyo.
export async function migrar(databaseUrl: string): Promise<void> {
  const cliente = new pg.Client({ connectionString: databaseUrl });
  await cliente.connect();
  try {
    // Es mejor que una migración falle a que bloquee las reservas.
    await cliente.query("set lock_timeout = '5s'");
    await migrate(drizzle(cliente), {
      migrationsFolder: CARPETA,
      migrationsSchema: "inventario",
      migrationsTable: "migraciones",
    });
  } finally {
    await cliente.end();
  }
}

if (import.meta.main) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Falta DATABASE_URL.");
  }
  await migrar(databaseUrl);
  console.log("Migraciones de inventario aplicadas.");
}
