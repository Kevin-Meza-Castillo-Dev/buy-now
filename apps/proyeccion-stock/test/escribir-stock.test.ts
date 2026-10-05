import type { Redis } from "ioredis";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { escribirStock } from "../src/escribir-stock.ts";
import { abrirRedis, productoDePrueba } from "./ayudas.ts";

// Spec 001, T035. RF-009, H4-E1: el stock visible de un producto es el del evento con la
// versión más alta. Un evento repetido o atrasado no cambia la clave. La regla vive en un
// script de Redis, así que la prueba va contra un Redis real.

describe("escribirStock", () => {
  let redis: Redis;
  let productoId: number;
  let clave: string;

  beforeEach(() => {
    redis = abrirRedis();
    productoId = productoDePrueba();
    clave = `stock:${productoId}`;
  });

  afterEach(async () => {
    await redis.del(clave);
    await redis.quit();
  });

  it("escribe la clave si no existe, como un hash sin vencimiento", async () => {
    const escrito = await escribirStock(redis, {
      producto_id: productoId,
      disponible: 7,
      version: 3,
    });

    expect(escrito).toBe(true);
    expect(await redis.hgetall(clave)).toEqual({ disponible: "7", version: "3" });
    expect(await redis.ttl(clave)).toBe(-1);
  });

  it("un evento con versión mayor cambia la clave", async () => {
    await escribirStock(redis, { producto_id: productoId, disponible: 7, version: 3 });

    const escrito = await escribirStock(redis, {
      producto_id: productoId,
      disponible: 5,
      version: 4,
    });

    expect(escrito).toBe(true);
    expect(await redis.hgetall(clave)).toEqual({ disponible: "5", version: "4" });
  });

  it.each([
    ["igual", 4],
    ["menor", 3],
  ])("un evento con versión %s no cambia la clave", async (_caso, version) => {
    await escribirStock(redis, { producto_id: productoId, disponible: 5, version: 4 });

    const escrito = await escribirStock(redis, { producto_id: productoId, disponible: 9, version });

    expect(escrito).toBe(false);
    expect(await redis.hgetall(clave)).toEqual({ disponible: "5", version: "4" });
  });

  it("la versión 0 se escribe si la clave no existe", async () => {
    const escrito = await escribirStock(redis, {
      producto_id: productoId,
      disponible: 50,
      version: 0,
    });

    expect(escrito).toBe(true);
    expect(await redis.hgetall(clave)).toEqual({ disponible: "50", version: "0" });
  });

  it("compara las versiones como números, no como texto", async () => {
    await escribirStock(redis, { producto_id: productoId, disponible: 5, version: 9 });

    const escrito = await escribirStock(redis, {
      producto_id: productoId,
      disponible: 4,
      version: 10,
    });

    expect(escrito).toBe(true);
    expect(await redis.hgetall(clave)).toEqual({ disponible: "4", version: "10" });
  });
});
