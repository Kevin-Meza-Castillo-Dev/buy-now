import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Redis } from "ioredis";
import type pg from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { borrarLoQueLaCargaDejaViejo } from "../scripts/cargar-datos.ts";
import { levantarApp, vaciarCatalogo } from "./app.ts";
import { abrirTransaccion, deshacerTransaccion } from "./base.ts";
import { insertarCategoria, insertarProducto } from "./catalogo-de-prueba.ts";
import { abrirRedis, conRedisCaido, escribirStockVisible } from "./redis.ts";

// Spec 001, T031. CE-001: las respuestas del catálogo se guardan 60 segundos en Redis, sin
// el stock. La segunda lectura no consulta Postgres, y con Redis caído el catálogo responde.

describe("caché del catálogo", () => {
  let cliente: pg.Client;
  let redis: Redis;
  let app: NestFastifyApplication;
  let limon: number;

  beforeEach(async () => {
    cliente = await abrirTransaccion();
    redis = abrirRedis();
    await vaciarCatalogo(cliente);
    await insertarCategoria(cliente, { id: 1, nombre: "Frutas y verduras", orden: 1 });
    limon = await insertarProducto(cliente, { nombre: "Limón", categoria_id: 1, disponible: 10 });
    app = await levantarApp(cliente);
  });

  afterEach(async () => {
    await app.close();
    await redis.quit();
    await deshacerTransaccion(cliente);
  });

  // Cambia los datos en Postgres por debajo del servicio. Si la respuesta siguiente trae
  // los datos de antes, salió de la caché.
  async function cambiarEnPostgres(): Promise<void> {
    await cliente.query("update inventario.categorias set nombre = 'Otra' where id = 1");
    await cliente.query(
      "update inventario.productos set nombre = 'Lima', nombre_busqueda = 'lima' where id = $1",
      [limon],
    );
  }

  async function esperaDe(clave: string): Promise<number> {
    return redis.ttl(clave);
  }

  async function clavesDelCatalogo(): Promise<string[]> {
    return (await redis.keys("catalogo:*")).sort();
  }

  it("la segunda lectura de las categorías sale de la caché", async () => {
    await request(app.getHttpServer()).get("/categorias").expect(200);
    await cambiarEnPostgres();

    const respuesta = await request(app.getHttpServer()).get("/categorias").expect(200);

    expect(respuesta.body).toEqual({ categorias: [{ id: 1, nombre: "Frutas y verduras" }] });
  });

  it("la segunda lectura de la lista sale de la caché", async () => {
    await request(app.getHttpServer()).get("/productos").expect(200);
    await request(app.getHttpServer()).get("/productos?categoria=1").expect(200);
    await cambiarEnPostgres();

    const todos = await request(app.getHttpServer()).get("/productos").expect(200);
    const deLaCategoria = await request(app.getHttpServer())
      .get("/productos?categoria=1")
      .expect(200);

    expect(todos.body.productos.map((p: { nombre: string }) => p.nombre)).toEqual(["Limón"]);
    expect(deLaCategoria.body).toEqual(todos.body);
  });

  it("la segunda lectura del detalle sale de la caché", async () => {
    await request(app.getHttpServer()).get(`/productos/${limon}`).expect(200);
    await cambiarEnPostgres();

    const respuesta = await request(app.getHttpServer()).get(`/productos/${limon}`).expect(200);

    expect(respuesta.body.nombre).toBe("Limón");
    expect(respuesta.body.categoria).toEqual({ id: 1, nombre: "Frutas y verduras" });
  });

  it("guarda cada respuesta en su clave, y vence a los 60 segundos", async () => {
    await request(app.getHttpServer()).get("/categorias").expect(200);
    await request(app.getHttpServer()).get("/productos").expect(200);
    await request(app.getHttpServer()).get("/productos?categoria=1&pagina=1").expect(200);
    await request(app.getHttpServer()).get(`/productos/${limon}`).expect(200);

    const claves = await clavesDelCatalogo();

    expect(claves).toEqual(
      [
        "catalogo:categorias",
        "catalogo:lista:1:1",
        "catalogo:lista:todas:1",
        `catalogo:producto:${limon}`,
      ].sort(),
    );
    for (const clave of claves) {
      const espera = await esperaDe(clave);
      expect(espera, clave).toBeGreaterThan(50);
      expect(espera, clave).toBeLessThanOrEqual(60);
    }
  });

  it("el stock no se guarda: cambia aunque la lista y el detalle salgan de la caché", async () => {
    await request(app.getHttpServer()).get("/productos").expect(200);
    await request(app.getHttpServer()).get(`/productos/${limon}`).expect(200);
    await escribirStockVisible(redis, limon, { disponible: 2, version: 7 });

    const lista = await request(app.getHttpServer()).get("/productos").expect(200);
    const detalle = await request(app.getHttpServer()).get(`/productos/${limon}`).expect(200);

    expect(lista.body.productos[0].stock_visible).toBe(2);
    expect(detalle.body.stock_visible).toBe(2);
    for (const clave of await clavesDelCatalogo()) {
      expect(await redis.get(clave), clave).not.toContain("stock_visible");
    }
  });

  it("una búsqueda con texto no se guarda: va a Postgres", async () => {
    await request(app.getHttpServer()).get("/productos?buscar=limon").expect(200);
    await cambiarEnPostgres();

    const respuesta = await request(app.getHttpServer()).get("/productos?buscar=limon").expect(200);

    expect(respuesta.body.productos).toEqual([]);
    expect(await clavesDelCatalogo()).toEqual([]);
  });

  it("no guarda una página vacía ni un producto que no existe", async () => {
    await request(app.getHttpServer()).get("/productos?pagina=9").expect(200);
    await request(app.getHttpServer()).get("/productos?categoria=5").expect(200);
    await request(app.getHttpServer()).get("/productos/2147483600").expect(404);

    expect(await clavesDelCatalogo()).toEqual([]);
  });

  it("con Redis caído, el catálogo responde desde Postgres", async () => {
    await app.close();
    app = await conRedisCaido(() => levantarApp(cliente));

    const categorias = await request(app.getHttpServer()).get("/categorias").expect(200);
    const lista = await request(app.getHttpServer()).get("/productos").expect(200);
    const detalle = await request(app.getHttpServer()).get(`/productos/${limon}`).expect(200);

    expect(categorias.body.categorias).toHaveLength(1);
    expect(lista.body.productos).toHaveLength(1);
    expect(detalle.body.nombre).toBe("Limón");
  });

  it("un valor dañado en la caché no rompe la respuesta", async () => {
    await redis.set("catalogo:categorias", "esto no es JSON", "EX", 60);

    const respuesta = await request(app.getHttpServer()).get("/categorias").expect(200);

    expect(respuesta.body).toEqual({ categorias: [{ id: 1, nombre: "Frutas y verduras" }] });
  });

  describe("la carga de datos", () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).get("/categorias").expect(200);
      await request(app.getHttpServer()).get("/productos").expect(200);
      await request(app.getHttpServer()).get(`/productos/${limon}`).expect(200);
      await redis.set("otra:clave", "se queda");
    });

    it("borra la caché del catálogo y deja el stock visible", async () => {
      await borrarLoQueLaCargaDejaViejo(redis, { reiniciarStock: false });

      expect(await redis.keys("*")).toEqual(
        expect.arrayContaining(["otra:clave", `stock:${limon}`]),
      );
      expect(await clavesDelCatalogo()).toEqual([]);
    });

    it("con el stock reiniciado, borra también el stock visible", async () => {
      await borrarLoQueLaCargaDejaViejo(redis, { reiniciarStock: true });

      expect(await clavesDelCatalogo()).toEqual([]);
      expect(await redis.keys("stock:*")).toEqual([]);
      expect(await redis.get("otra:clave")).toBe("se queda");
    });
  });
});
