import { respuestaCategorias } from "@buy-now/contratos";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type pg from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { levantarApp, vaciarCatalogo } from "./app.ts";
import { abrirTransaccion, deshacerTransaccion } from "./base.ts";

// Spec 001, T014. RF-004, H3-E2: el cliente ve todas las categorías, en su orden.

describe("GET /categorias", () => {
  let cliente: pg.Client;
  let app: NestFastifyApplication;

  beforeEach(async () => {
    cliente = await abrirTransaccion();
    await vaciarCatalogo(cliente);
    app = await levantarApp(cliente);
  });

  afterEach(async () => {
    await app.close();
    await deshacerTransaccion(cliente);
  });

  it("devuelve todas las categorías, ordenadas por su orden y no por su id", async () => {
    await cliente.query(
      `insert into inventario.categorias (id, nombre, orden)
       values (1, 'Bebidas', 3), (2, 'Frutas y verduras', 1), (3, 'Panadería', 2)`,
    );

    const respuesta = await request(app.getHttpServer()).get("/categorias").expect(200);

    expect(respuesta.body).toEqual({
      categorias: [
        { id: 2, nombre: "Frutas y verduras" },
        { id: 3, nombre: "Panadería" },
        { id: 1, nombre: "Bebidas" },
      ],
    });
    expect(respuestaCategorias.safeParse(respuesta.body).success).toBe(true);
  });

  it("sin categorías, devuelve la lista vacía", async () => {
    const respuesta = await request(app.getHttpServer()).get("/categorias").expect(200);

    expect(respuesta.body).toEqual({ categorias: [] });
  });
});
