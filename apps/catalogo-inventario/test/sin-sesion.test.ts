import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, it } from "vitest";
import { levantarApp, vaciarCatalogo } from "./app.ts";
import { abrirTransaccion, deshacerTransaccion } from "./base.ts";
import { insertarCategoria, insertarProducto } from "./catalogo-de-prueba.ts";

// Spec 001, T024. H1-E6: el catálogo se ve sin cuenta. Ningún endpoint del catálogo pide
// sesión, y un token que no vale tampoco lo impide.

describe("el catálogo responde sin sesión", () => {
  let cliente: pg.Client;
  let app: NestFastifyApplication;
  let rutas: string[];

  beforeAll(async () => {
    cliente = await abrirTransaccion();
    await vaciarCatalogo(cliente);
    await insertarCategoria(cliente, { id: 1, nombre: "Frutas y verduras", orden: 1 });
    const id = await insertarProducto(cliente, { nombre: "Limón", categoria_id: 1 });
    rutas = [
      "/categorias",
      "/productos",
      "/productos?buscar=limon",
      `/productos/${id}`,
      "/fotos/limon.webp",
    ];
    app = await levantarApp(cliente);
  });

  afterAll(async () => {
    await app.close();
    await deshacerTransaccion(cliente);
  });

  it("sin cabecera Authorization", async () => {
    for (const ruta of rutas) {
      await request(app.getHttpServer()).get(ruta).expect(200);
    }
  });

  it("con un token que no vale", async () => {
    for (const ruta of rutas) {
      await request(app.getHttpServer())
        .get(ruta)
        .set("Authorization", "Bearer no-es-un-token")
        .expect(200);
    }
  });
});
