import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { consumir, type Consumidor } from "../src/consumidor.ts";
import {
  abrirRedis,
  brokersDeKafka,
  crearTopic,
  esperarA,
  eventoDeStock,
  productoDePrueba,
  publicar,
} from "./ayudas.ts";

// Spec 001, T037. RF-009: un evento `inventario.stock-cambiado.v1` del topic
// `inventario.eventos` deja el stock visible en Redis. Kafka puede entregar un evento más
// de una vez o fuera de orden, y el resultado debe ser el mismo.

describe("consumidor de inventario.eventos", () => {
  let redis: Redis;
  let consumidor: Consumidor | undefined;
  let productoId: number;
  let clave: string;
  let avisos: string[];

  // Cada prueba usa un grupo nuevo, que lee el topic desde el principio.
  async function arrancar(): Promise<void> {
    consumidor = await consumir({
      brokers: brokersDeKafka(),
      grupo: `prueba-${randomUUID()}`,
      redis,
      avisar: (mensaje) => avisos.push(mensaje),
    });
  }

  async function stock(): Promise<Record<string, string>> {
    return redis.hgetall(clave);
  }

  beforeAll(async () => {
    await crearTopic();
  });

  beforeEach(() => {
    redis = abrirRedis();
    productoId = productoDePrueba();
    clave = `stock:${productoId}`;
    avisos = [];
  });

  afterEach(async () => {
    await consumidor?.detener();
    consumidor = undefined;
    // El grupo nuevo relee todo el topic y escribe también los productos de otras pruebas.
    await redis.flushdb();
    await redis.quit();
  });

  it("un evento deja el stock del producto en Redis", async () => {
    await arrancar();

    await publicar(productoId, [
      eventoDeStock({ producto_id: productoId, disponible: 12, version: 1 }),
    ]);

    await esperarA(async () => (await stock()).version === "1");
    expect(await stock()).toEqual({ disponible: "12", version: "1" });
  });

  it("repetir un evento no cambia nada", async () => {
    const evento = eventoDeStock({ producto_id: productoId, disponible: 12, version: 1 });
    const siguiente = eventoDeStock({ producto_id: productoId, disponible: 11, version: 2 });
    await arrancar();

    await publicar(productoId, [evento, siguiente, evento, evento]);
    // El centinela es de otro producto: cuando llega, todo lo anterior ya se procesó.
    const centinela = productoDePrueba();
    await publicar(centinela, [
      eventoDeStock({ producto_id: centinela, disponible: 1, version: 1 }),
    ]);

    await esperarA(async () => (await redis.exists(`stock:${centinela}`)) === 1);
    await redis.del(`stock:${centinela}`);
    expect(await stock()).toEqual({ disponible: "11", version: "2" });
  });

  it("un evento atrasado no pisa uno más nuevo", async () => {
    await arrancar();

    await publicar(productoId, [
      eventoDeStock({ producto_id: productoId, disponible: 3, version: 8 }),
      eventoDeStock({ producto_id: productoId, disponible: 9, version: 5 }),
    ]);
    const centinela = productoDePrueba();
    await publicar(centinela, [
      eventoDeStock({ producto_id: centinela, disponible: 1, version: 1 }),
    ]);

    await esperarA(async () => (await redis.exists(`stock:${centinela}`)) === 1);
    await redis.del(`stock:${centinela}`);
    expect(await stock()).toEqual({ disponible: "3", version: "8" });
  });

  it("un mensaje que no es un evento de stock se salta, y sigue con el siguiente", async () => {
    await arrancar();

    await publicar(productoId, [
      "esto no es JSON",
      JSON.stringify({ id: randomUUID(), tipo: "inventario.otra-cosa.v1", datos: {} }),
      JSON.stringify({
        ...eventoDeStock({ producto_id: productoId, disponible: 1, version: 1 }),
        datos: { producto_id: productoId, disponible: -4, version: 1, motivo: "reserva" },
      }),
      eventoDeStock({ producto_id: productoId, disponible: 6, version: 2 }),
    ]);

    await esperarA(async () => (await stock()).version === "2");
    expect(await stock()).toEqual({ disponible: "6", version: "2" });
    expect(avisos.length).toBeGreaterThanOrEqual(3);
  });

  it("un consumidor que arranca después lee los eventos que ya estaban en el topic", async () => {
    await publicar(productoId, [
      eventoDeStock({ producto_id: productoId, disponible: 20, version: 4 }),
    ]);

    await arrancar();

    await esperarA(async () => (await stock()).version === "4");
    expect(await stock()).toEqual({ disponible: "20", version: "4" });
  });

  it("si Redis falla al escribir, el evento se reintenta y no se pierde", async () => {
    const escribir = redis.eval.bind(redis) as (...argumentos: unknown[]) => Promise<unknown>;
    let fallos = 2;
    redis.eval = ((...argumentos: unknown[]) =>
      fallos-- > 0
        ? Promise.reject(new Error("Redis no responde"))
        : escribir(...argumentos)) as typeof redis.eval;
    await arrancar();

    await publicar(productoId, [
      eventoDeStock({ producto_id: productoId, disponible: 12, version: 1 }),
    ]);

    await esperarA(async () => (await stock()).version === "1");
    expect(fallos).toBeLessThan(0);
  });

  it("al detenerlo deja de leer", async () => {
    await arrancar();
    await publicar(productoId, [
      eventoDeStock({ producto_id: productoId, disponible: 12, version: 1 }),
    ]);
    await esperarA(async () => (await stock()).version === "1");

    await consumidor!.detener();
    consumidor = undefined;
    await publicar(productoId, [
      eventoDeStock({ producto_id: productoId, disponible: 2, version: 2 }),
    ]);
    await new Promise((listo) => setTimeout(listo, 1500));

    expect(await stock()).toEqual({ disponible: "12", version: "1" });
  });
});
