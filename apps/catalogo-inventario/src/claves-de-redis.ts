import type { Redis } from "ioredis";

// Las claves de este servicio en Redis. Este archivo no usa decoradores, para que los
// scripts lo puedan importar sin compilar.

// Respuestas del catálogo: `catalogo:categorias`, `catalogo:lista:{categoria}:{pagina}` y
// `catalogo:producto:{id}`.
export const PREFIJO_DEL_CATALOGO = "catalogo:";

// Stock visible: `stock:{producto_id}`, un hash con `disponible` y `version`.
export const PREFIJO_DEL_STOCK = "stock:";

// Borra todas las claves que empiezan por el prefijo. Recorre con SCAN, para no detener
// Redis como lo haría KEYS.
export async function borrarClaves(redis: Redis, prefijo: string): Promise<void> {
  let cursor = "0";
  do {
    const [siguiente, claves] = await redis.scan(cursor, "MATCH", `${prefijo}*`, "COUNT", 500);
    if (claves.length > 0) {
      await redis.unlink(...claves);
    }
    cursor = siguiente;
  } while (cursor !== "0");
}
