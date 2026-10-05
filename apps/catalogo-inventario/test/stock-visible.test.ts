import type { ProductoDetalle, RespuestaProductos } from "@buy-now/contratos";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Redis } from "ioredis";
import type pg from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { levantarApp, vaciarCatalogo } from "./app.ts";
import { abrirTransaccion, deshacerTransaccion } from "./base.ts";
import { insertarCategoria, insertarProducto } from "./catalogo-de-prueba.ts";
import { abrirRedis, conRedisCaido, escribirStockVisible } from "./redis.ts";

// Spec 001, T027. RF-009 y caso límite "Redis caído o vacío": el stock visible se lee de
// Redis; si falta la clave o Redis no responde, se lee de Postgres.

describe("stock visible", () => {
  let cliente: pg.Client;
  let redis: Redis;
  let app: NestFastifyApplication;
  let limon: number;
  let mango: number;

  beforeEach(async () => {
    cliente = await abrirTransaccion();
    redis = abrirRedis();
    await vaciarCatalogo(cliente);
    await insertarCategoria(cliente, { id: 1, nombre: "Frutas y verduras", orden: 1 });
    limon = await insertarProducto(cliente, { nombre: "Limón", categoria_id: 1, disponible: 10 });
    mango = await insertarProducto(cliente, { nombre: "Mango", categoria_id: 1, disponible: 7 });
    await cliente.query("update inventario.stock set version = 4 where producto_id = $1", [mango]);
  });

  afterEach(async () => {
    await app.close();
    await redis.del(`stock:${limon}`, `stock:${mango}`);
    await redis.quit();
    await deshacerTransaccion(cliente);
  });

  async function stockEnLaLista(): Promise<Record<string, number>> {
    const respuesta = await request(app.getHttpServer()).get("/productos").expect(200);
    return Object.fromEntries(
      (respuesta.body as RespuestaProductos).productos.map((producto) => [
        producto.nombre,
        producto.stock_visible,
      ]),
    );
  }

  async function stockEnElDetalle(id: number): Promise<number> {
    const respuesta = await request(app.getHttpServer()).get(`/productos/${id}`).expect(200);
    return (respuesta.body as ProductoDetalle).stock_visible;
  }

  it("la lista y el detalle muestran el stock que está en Redis", async () => {
    await escribirStockVisible(redis, limon, { disponible: 3, version: 2 });
    await escribirStockVisible(redis, mango, { disponible: 0, version: 9 });
    app = await levantarApp(cliente);

    expect(await stockEnLaLista()).toEqual({ Limón: 3, Mango: 0 });
    expect(await stockEnElDetalle(limon)).toBe(3);
    expect(await stockEnElDetalle(mango)).toBe(0);
  });

  it("si falta la clave, lee el stock de Postgres", async () => {
    await escribirStockVisible(redis, limon, { disponible: 3, version: 2 });
    app = await levantarApp(cliente);

    expect(await stockEnLaLista()).toEqual({ Limón: 3, Mango: 7 });
    expect(await stockEnElDetalle(mango)).toBe(7);
  });

  it("al leer de Postgres, deja la clave escrita con su versión", async () => {
    app = await levantarApp(cliente);

    await stockEnLaLista();

    expect(await redis.hgetall(`stock:${limon}`)).toEqual({ disponible: "10", version: "0" });
    expect(await redis.hgetall(`stock:${mango}`)).toEqual({ disponible: "7", version: "4" });
  });

  it("con Redis caído, lee el stock de Postgres", async () => {
    await escribirStockVisible(redis, limon, { disponible: 3, version: 2 });
    app = await conRedisCaido(() => levantarApp(cliente));

    expect(await stockEnLaLista()).toEqual({ Limón: 10, Mango: 7 });
    expect(await stockEnElDetalle(limon)).toBe(10);
  });
});
