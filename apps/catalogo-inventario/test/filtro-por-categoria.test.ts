import type { RespuestaProductos } from "@buy-now/contratos";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type pg from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { levantarApp, vaciarCatalogo } from "./app.ts";
import { abrirTransaccion, deshacerTransaccion } from "./base.ts";
import { insertarCategoria, insertarProducto } from "./catalogo-de-prueba.ts";

// Spec 001, T020. RF-004, H3-E2: filtrar por categoría, sola y junto con la búsqueda.

describe("GET /productos?categoria=", () => {
  let cliente: pg.Client;
  let app: NestFastifyApplication;

  beforeEach(async () => {
    cliente = await abrirTransaccion();
    await vaciarCatalogo(cliente);
    await insertarCategoria(cliente, { id: 1, nombre: "Frutas y verduras", orden: 1 });
    await insertarCategoria(cliente, { id: 2, nombre: "Bebidas", orden: 2 });
    await insertarCategoria(cliente, { id: 3, nombre: "Mascotas", orden: 3 });
    await insertarProducto(cliente, { nombre: "Limón 250 g", categoria_id: 1 });
    await insertarProducto(cliente, { nombre: "Naranja 1 kg", categoria_id: 1 });
    await insertarProducto(cliente, { nombre: "Jugo de limón 1 L", categoria_id: 2 });
    await insertarProducto(cliente, { nombre: "Agua 600 ml", categoria_id: 2 });
    await insertarProducto(cliente, { nombre: "Té retirado", categoria_id: 2, activo: false });
    app = await levantarApp(cliente);
  });

  afterEach(async () => {
    await app.close();
    await deshacerTransaccion(cliente);
  });

  async function nombres(consulta: Record<string, string | number>): Promise<string[]> {
    const respuesta = await request(app.getHttpServer())
      .get("/productos")
      .query(consulta)
      .expect(200);
    return (respuesta.body as RespuestaProductos).productos.map((producto) => producto.nombre);
  }

  it("devuelve solo los productos activos de la categoría", async () => {
    expect(await nombres({ categoria: 2 })).toEqual(["Agua 600 ml", "Jugo de limón 1 L"]);
    expect(await nombres({ categoria: 1 })).toEqual(["Limón 250 g", "Naranja 1 kg"]);
  });

  it("junto con la búsqueda, devuelve los que cumplen las dos condiciones", async () => {
    expect(await nombres({ categoria: 2, buscar: "limon" })).toEqual(["Jugo de limón 1 L"]);
    expect(await nombres({ categoria: 1, buscar: "limon" })).toEqual(["Limón 250 g"]);
    expect(await nombres({ categoria: 1, buscar: "agua" })).toEqual([]);
  });

  it("una categoría sin productos, o que no existe, devuelve la lista vacía", async () => {
    expect(await nombres({ categoria: 3 })).toEqual([]);
    expect(await nombres({ categoria: 999 })).toEqual([]);
    expect(await nombres({ categoria: 40000 })).toEqual([]);
    expect(await nombres({ categoria: 99999999999 })).toEqual([]);
  });

  it("pagina los productos de la categoría", async () => {
    for (let numero = 0; numero < 25; numero++) {
      await insertarProducto(cliente, { nombre: `Alpiste ${numero}`, categoria_id: 3 });
    }

    const primera = await request(app.getHttpServer()).get("/productos?categoria=3").expect(200);
    const segunda = await request(app.getHttpServer())
      .get("/productos?categoria=3&pagina=2")
      .expect(200);

    expect(primera.body.productos).toHaveLength(20);
    expect(primera.body.hay_mas).toBe(true);
    expect(segunda.body.productos).toHaveLength(5);
    expect(segunda.body.hay_mas).toBe(false);
  });

  it.each(["0", "-1", "abc", "1.5"])('rechaza categoria="%s" con 422', async (categoria) => {
    const respuesta = await request(app.getHttpServer())
      .get("/productos")
      .query({ categoria })
      .expect(422);

    expect(respuesta.body).toEqual({
      codigo: "datos_invalidos",
      mensaje: "Revisa los campos marcados.",
      campos: { categoria: "El valor no es válido." },
    });
  });
});
