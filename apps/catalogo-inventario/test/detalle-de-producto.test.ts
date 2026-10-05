import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type pg from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { levantarApp, vaciarCatalogo } from "./app.ts";
import { abrirTransaccion, deshacerTransaccion } from "./base.ts";
import { insertarCategoria, insertarProducto } from "./catalogo-de-prueba.ts";

// Spec 001, T022. RF-002, H2-E1: el detalle de un producto trae su descripción, su
// categoría y sus unidades disponibles.

describe("GET /productos/{id}", () => {
  let cliente: pg.Client;
  let app: NestFastifyApplication;

  beforeEach(async () => {
    cliente = await abrirTransaccion();
    await vaciarCatalogo(cliente);
    await insertarCategoria(cliente, { id: 7, nombre: "Frutas y verduras", orden: 1 });
    app = await levantarApp(cliente);
  });

  afterEach(async () => {
    await app.close();
    await deshacerTransaccion(cliente);
  });

  const NO_ENCONTRADO = {
    codigo: "producto_no_encontrado",
    mensaje: "Este producto ya no está disponible.",
  };

  it("devuelve el producto con su descripción, su categoría y sus unidades", async () => {
    const id = await insertarProducto(cliente, {
      nombre: "Limón 250 g",
      categoria_id: 7,
      precio_centavos: 1250,
      descripcion: "Limón fresco, en malla de 250 g.",
      foto_ruta: "limon.webp",
      disponible: 8,
    });

    const respuesta = await request(app.getHttpServer()).get(`/productos/${id}`).expect(200);

    expect(respuesta.body).toEqual({
      id,
      nombre: "Limón 250 g",
      precio_centavos: 1250,
      foto_url: "/fotos/limon.webp",
      categoria_id: 7,
      stock_visible: 8,
      descripcion: "Limón fresco, en malla de 250 g.",
      categoria: { id: 7, nombre: "Frutas y verduras" },
    });
  });

  it("un producto agotado se devuelve con 0 unidades", async () => {
    const id = await insertarProducto(cliente, { nombre: "Mango", categoria_id: 7, disponible: 0 });

    const respuesta = await request(app.getHttpServer()).get(`/productos/${id}`).expect(200);

    expect(respuesta.body.stock_visible).toBe(0);
  });

  it("responde 404 si el producto no existe", async () => {
    const respuesta = await request(app.getHttpServer()).get("/productos/999999").expect(404);

    expect(respuesta.body).toEqual(NO_ENCONTRADO);
  });

  it("responde 404 si el producto no está activo", async () => {
    const id = await insertarProducto(cliente, { nombre: "Pera", categoria_id: 7, activo: false });

    const respuesta = await request(app.getHttpServer()).get(`/productos/${id}`).expect(404);

    expect(respuesta.body).toEqual(NO_ENCONTRADO);
  });

  it.each(["abc", "0", "-1", "1.5", "99999999999999999999"])(
    'responde 404 si el id es "%s"',
    async (id) => {
      const respuesta = await request(app.getHttpServer()).get(`/productos/${id}`).expect(404);

      expect(respuesta.body).toEqual(NO_ENCONTRADO);
    },
  );
});
