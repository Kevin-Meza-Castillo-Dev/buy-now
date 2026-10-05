import { respuestaProductos, type RespuestaProductos } from "@buy-now/contratos";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type pg from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { levantarApp, vaciarCatalogo } from "./app.ts";
import { abrirTransaccion, deshacerTransaccion } from "./base.ts";
import { insertarCategoria, insertarProducto } from "./catalogo-de-prueba.ts";

// Spec 001, T016. RF-001, RF-005, H1-E1, H1-E5: la lista de productos, por páginas.

describe("GET /productos", () => {
  let cliente: pg.Client;
  let app: NestFastifyApplication;

  beforeEach(async () => {
    cliente = await abrirTransaccion();
    await vaciarCatalogo(cliente);
    await insertarCategoria(cliente, { id: 1, nombre: "Bebidas", orden: 2 });
    await insertarCategoria(cliente, { id: 2, nombre: "Frutas y verduras", orden: 1 });
    app = await levantarApp(cliente);
  });

  afterEach(async () => {
    await app.close();
    await deshacerTransaccion(cliente);
  });

  async function pedir(consulta = ""): Promise<RespuestaProductos> {
    const respuesta = await request(app.getHttpServer()).get(`/productos${consulta}`).expect(200);
    expect(respuestaProductos.safeParse(respuesta.body).success).toBe(true);
    return respuesta.body as RespuestaProductos;
  }

  it("devuelve cada producto con nombre, precio, foto, categoría y stock visible", async () => {
    const id = await insertarProducto(cliente, {
      nombre: "Limón Verde Valle 250 g",
      categoria_id: 2,
      precio_centavos: 125,
      foto_ruta: "limon.webp",
      disponible: 7,
    });

    expect(await pedir()).toEqual({
      productos: [
        {
          id,
          nombre: "Limón Verde Valle 250 g",
          precio_centavos: 125,
          foto_url: "/fotos/limon.webp",
          categoria_id: 2,
          stock_visible: 7,
        },
      ],
      pagina: 1,
      hay_mas: false,
    });
  });

  it("ordena por el orden de la categoría y, dentro de ella, por nombre sin distinguir mayúsculas ni tildes", async () => {
    await insertarProducto(cliente, { nombre: "Agua", categoria_id: 1 });
    await insertarProducto(cliente, { nombre: "Naranja", categoria_id: 2 });
    await insertarProducto(cliente, { nombre: "banano", categoria_id: 2 });
    await insertarProducto(cliente, { nombre: "Ají", categoria_id: 2 });
    await insertarProducto(cliente, { nombre: "Árbol de tomate", categoria_id: 2 });

    const { productos } = await pedir();

    expect(productos.map((producto) => producto.nombre)).toEqual([
      "Ají",
      "Árbol de tomate",
      "banano",
      "Naranja",
      "Agua",
    ]);
  });

  it("entrega páginas de 20 que no repiten ni saltan productos", async () => {
    const ids: number[] = [];
    // Nombres repetidos a propósito: el orden debe ser estable aunque empaten.
    for (let numero = 0; numero < 45; numero++) {
      ids.push(await insertarProducto(cliente, { nombre: `Jugo ${numero % 3}`, categoria_id: 1 }));
    }

    const primera = await pedir("?pagina=1");
    const segunda = await pedir("?pagina=2");
    const tercera = await pedir("?pagina=3");
    const cuarta = await pedir("?pagina=4");

    expect(primera.productos).toHaveLength(20);
    expect(segunda.productos).toHaveLength(20);
    expect(tercera.productos).toHaveLength(5);
    expect([primera.hay_mas, segunda.hay_mas, tercera.hay_mas]).toEqual([true, true, false]);
    expect([primera.pagina, segunda.pagina, tercera.pagina]).toEqual([1, 2, 3]);
    const vistos = [...primera.productos, ...segunda.productos, ...tercera.productos].map(
      (producto) => producto.id,
    );
    expect(vistos.sort((a, b) => a - b)).toEqual(ids.sort((a, b) => a - b));
    expect(cuarta).toEqual({ productos: [], pagina: 4, hay_mas: false });
  });

  it("con 20 productos exactos, la primera página dice que no hay más", async () => {
    for (let numero = 0; numero < 20; numero++) {
      await insertarProducto(cliente, { nombre: `Jugo ${numero}`, categoria_id: 1 });
    }

    const pagina = await pedir();

    expect(pagina.productos).toHaveLength(20);
    expect(pagina.hay_mas).toBe(false);
  });

  it("solo muestra los productos activos", async () => {
    await insertarProducto(cliente, { nombre: "Agua", categoria_id: 1 });
    await insertarProducto(cliente, { nombre: "Gaseosa retirada", categoria_id: 1, activo: false });

    const { productos } = await pedir();

    expect(productos.map((producto) => producto.nombre)).toEqual(["Agua"]);
  });

  it("muestra los agotados, con stock visible 0", async () => {
    await insertarProducto(cliente, { nombre: "Agua", categoria_id: 1, disponible: 0 });

    const { productos } = await pedir();

    expect(productos.map((producto) => producto.stock_visible)).toEqual([0]);
  });

  it.each(["0", "-1", "abc", "1.5"])("rechaza la página %s con 422", async (pagina) => {
    const respuesta = await request(app.getHttpServer())
      .get(`/productos?pagina=${pagina}`)
      .expect(422);

    expect(respuesta.body).toEqual({
      codigo: "datos_invalidos",
      mensaje: "Revisa los campos marcados.",
      campos: { pagina: "El valor no es válido." },
    });
  });
});
