import { Redis } from "ioredis";

export function urlDeRedis(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("Falta REDIS_URL: las pruebas de integración necesitan un Redis.");
  }
  return url;
}

// Un cliente para que la prueba prepare y revise las claves que lee el servicio.
export function abrirRedis(): Redis {
  return new Redis(urlDeRedis());
}

// Deja el stock visible de un producto como lo dejaría `proyeccion-stock`.
export async function escribirStockVisible(
  redis: Redis,
  productoId: number,
  stock: { disponible: number; version: number },
): Promise<void> {
  await redis.hset(`stock:${productoId}`, stock);
}

// Levanta lo que haga `levantar` con REDIS_URL apuntando a un puerto donde no hay Redis.
export async function conRedisCaido<T>(levantar: () => Promise<T>): Promise<T> {
  const url = process.env.REDIS_URL;
  process.env.REDIS_URL = "redis://127.0.0.1:1";
  try {
    return await levantar();
  } finally {
    process.env.REDIS_URL = url;
  }
}
