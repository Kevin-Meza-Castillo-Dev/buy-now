import type { RespuestaProductos } from "@buy-now/contratos";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type pg from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { levantarApp, vaciarCatalogo } from "./app.ts";
import { abrirTransaccion, deshacerTransaccion } from "./base.ts";
import { insertarCategoria, insertarProducto } from "./catalogo-de-prueba.ts";

// Spec 001, T018. RF-003, H3-E1: buscar por texto en el nombre, sin distinguir mayúsculas
// ni tildes.

describe("GET /productos?buscar=", () => {
  let cliente: pg.Client;
  let app: NestFastifyApplication;

  beforeEach(async () => {
    cliente = await abrirTransaccion();
    await vaciarCatalogo(cliente);
    await insertarCategoria(cliente, { id: 1, nombre: "Frutas y verduras", orden: 1 });
    await insertarProducto(cliente, { nombre: "Limón Verde Valle 250 g", categoria_id: 1 });
    await insertarProducto(cliente, { nombre: "Jugo de limón 1 L", categoria_id: 1 });
    await insertarProducto(cliente, { nombre: "Naranja 100% natural", categoria_id: 1 });
    await insertarProducto(cliente, {
      nombre: "Limonada retirada",
      categoria_id: 1,
      activo: false,
    });
    app = await levantarApp(cliente);
  });

  afterEach(async () => {
    await app.close();
    await deshacerTransaccion(cliente);
  });

  async function nombres(buscar: string): Promise<string[]> {
    const respuesta = await request(app.getHttpServer())
      .get("/productos")
      .query({ buscar })
      .expect(200);
    return (respuesta.body as RespuestaProductos).productos.map((producto) => producto.nombre);
  }

  it.each(["limon", "LIMÓN", "Limón", "  limon  "])(
    '"%s" encuentra los productos con "Limón" en el nombre',
    async (texto) => {
      expect(await nombres(texto)).toEqual(["Jugo de limón 1 L", "Limón Verde Valle 250 g"]);
    },
  );

  it("encuentra el texto en cualquier parte del nombre", async () => {
    expect(await nombres("verde valle")).toEqual(["Limón Verde Valle 250 g"]);
  });

  it("sin coincidencias, devuelve la lista vacía", async () => {
    const respuesta = await request(app.getHttpServer())
      .get("/productos")
      .query({ buscar: "sandía" })
      .expect(200);

    expect(respuesta.body).toEqual({ productos: [], pagina: 1, hay_mas: false });
  });

  it("con el texto vacío, devuelve todos los productos activos", async () => {
    expect(await nombres("")).toHaveLength(3);
    expect(await nombres("   ")).toHaveLength(3);
  });

  it("trata % y _ como texto, no como comodines", async () => {
    expect(await nombres("%")).toEqual(["Naranja 100% natural"]);
    expect(await nombres("_")).toEqual([]);
  });

  it("pagina los resultados de la búsqueda", async () => {
    for (let numero = 0; numero < 25; numero++) {
      await insertarProducto(cliente, { nombre: `Mango ${numero}`, categoria_id: 1 });
    }

    const primera = await request(app.getHttpServer()).get("/productos?buscar=mango").expect(200);
    const segunda = await request(app.getHttpServer())
      .get("/productos?buscar=mango&pagina=2")
      .expect(200);

    expect(primera.body.productos).toHaveLength(20);
    expect(primera.body.hay_mas).toBe(true);
    expect(segunda.body.productos).toHaveLength(5);
    expect(segunda.body.hay_mas).toBe(false);
  });

  it("rechaza un texto de más de 60 caracteres con 422", async () => {
    const respuesta = await request(app.getHttpServer())
      .get("/productos")
      .query({ buscar: "a".repeat(61) })
      .expect(422);

    expect(respuesta.body).toEqual({
      codigo: "datos_invalidos",
      mensaje: "Revisa los campos marcados.",
      campos: { buscar: "El valor no es válido." },
    });
  });
});
