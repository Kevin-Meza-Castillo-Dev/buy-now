import pg from "pg";

export function urlDeLaBase(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta DATABASE_URL: las pruebas de integración necesitan un Postgres.");
  }
  return url;
}

// Cada prueba corre dentro de una transacción que se deshace al terminar, para no
// dejar filas en la base ni depender de lo que ya tenga.
export async function abrirTransaccion(): Promise<pg.Client> {
  const cliente = new pg.Client({ connectionString: urlDeLaBase() });
  await cliente.connect();
  await cliente.query("begin");
  return cliente;
}

export async function deshacerTransaccion(cliente: pg.Client): Promise<void> {
  await cliente.query("rollback");
  await cliente.end();
}

// Ejecuta una sentencia que Postgres debe rechazar y devuelve el error. El punto de
// guardado deja la transacción utilizable después del rechazo.
export async function rechazo(
  cliente: pg.Client,
  sentencia: string,
  valores: unknown[] = [],
): Promise<pg.DatabaseError> {
  await cliente.query("savepoint antes_del_rechazo");
  try {
    await cliente.query(sentencia, valores);
  } catch (error) {
    await cliente.query("rollback to savepoint antes_del_rechazo");
    if (error instanceof pg.DatabaseError) return error;
    throw error;
  }
  throw new Error(`Postgres aceptó una sentencia que debía rechazar: ${sentencia}`);
}
