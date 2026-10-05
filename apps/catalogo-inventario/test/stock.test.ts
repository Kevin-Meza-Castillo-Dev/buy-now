import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Redis } from "ioredis";
import type pg from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { levantarApp, vaciarCatalogo } from "./app.ts";
import { abrirTransaccion, deshacerTransaccion } from "./base.ts";
import { insertarCategoria, insertarProducto } from "./catalogo-de-prueba.ts";
import { abrirRedis, conRedisCaido, escribirStockVisible } from "./redis.ts";

// Spec 001, T029. RF-008, H4-E1: la app refresca el stock de los productos en pantalla
// con `GET /stock`, de 1 a 50 ids, y la respuesta se puede guardar 5 segundos.

describe("GET /stock", () => {
  let cliente: pg.Client;
  let redis: Redis;
  let app: NestFastifyApplication;
  let ids: number[];

  beforeEach(async () => {
    cliente = await abrirTransaccion();
    redis = abrirRedis();
    await vaciarCatalogo(cliente);
    await insertarCategoria(cliente, { id: 1, nombre: "Frutas y verduras", orden: 1 });
    ids = [];
    for (let numero = 0; numero < 51; numero++) {
      ids.push(
        await insertarProducto(cliente, {
          nombre: `Mango ${numero}`,
          categoria_id: 1,
          disponible: numero,
        }),
      );
    }
    app = await levantarApp(cliente);
  });

  afterEach(async () => {
    await app.close();
    await redis.del(...ids.map((id) => `stock:${id}`));
    await redis.quit();
    await deshacerTransaccion(cliente);
  });

  const INVALIDO = {
    codigo: "datos_invalidos",
    mensaje: "Revisa los campos marcados.",
    campos: { ids: "El valor no es válido." },
  };

  it("devuelve el stock visible de cada id, en el orden pedido", async () => {
    await escribirStockVisible(redis, ids[2]!, { disponible: 40, version: 3 });

    const respuesta = await request(app.getHttpServer())
      .get(`/stock?ids=${ids[5]},${ids[2]},${ids[0]}`)
      .expect(200);

    expect(respuesta.body).toEqual({
      stock: [
        { producto_id: ids[5], disponible: 5 },
        { producto_id: ids[2], disponible: 40 },
        { producto_id: ids[0], disponible: 0 },
      ],
    });
  });

  it("la respuesta se puede guardar en caché 5 segundos", async () => {
    const respuesta = await request(app.getHttpServer()).get(`/stock?ids=${ids[0]}`).expect(200);

    expect(respuesta.headers["cache-control"]).toBe("public, max-age=5");
  });

  it("acepta 50 ids", async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/stock?ids=${ids.slice(0, 50).join(",")}`)
      .expect(200);

    expect(respuesta.body.stock).toHaveLength(50);
  });

  it("rechaza más de 50 ids con 422", async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/stock?ids=${ids.join(",")}`)
      .expect(422);

    expect(respuesta.body).toEqual(INVALIDO);
  });

  it.each(["", "abc", "1,abc", "1,,2", "0", "-3", "1.5", "1;2"])(
    'rechaza ids="%s" con 422',
    async (texto) => {
      const respuesta = await request(app.getHttpServer())
        .get("/stock")
        .query({ ids: texto })
        .expect(422);

      expect(respuesta.body).toEqual(INVALIDO);
    },
  );

  it("rechaza la petición sin ids con 422", async () => {
    const respuesta = await request(app.getHttpServer()).get("/stock").expect(422);

    expect(respuesta.body).toEqual(INVALIDO);
  });

  it("un id repetido sale una sola vez", async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/stock?ids=${ids[1]},${ids[1]},${ids[3]}`)
      .expect(200);

    expect(respuesta.body.stock).toEqual([
      { producto_id: ids[1], disponible: 1 },
      { producto_id: ids[3], disponible: 3 },
    ]);
  });

  it("deja fuera los ids que no son de ningún producto", async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/stock?ids=${ids[4]},2147483600,99999999999`)
      .expect(200);

    expect(respuesta.body).toEqual({ stock: [{ producto_id: ids[4], disponible: 4 }] });
  });

  it("no exige sesión", async () => {
    await request(app.getHttpServer())
      .get(`/stock?ids=${ids[0]}`)
      .set("Authorization", "Bearer no-es-un-token")
      .expect(200);
  });

  it("con Redis caído, responde con el stock de Postgres", async () => {
    await app.close();
    app = await conRedisCaido(() => levantarApp(cliente));

    const respuesta = await request(app.getHttpServer())
      .get(`/stock?ids=${ids[6]},${ids[7]}`)
      .expect(200);

    expect(respuesta.body).toEqual({
      stock: [
        { producto_id: ids[6], disponible: 6 },
        { producto_id: ids[7], disponible: 7 },
      ],
    });
  });
});
