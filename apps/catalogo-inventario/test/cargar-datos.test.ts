import type pg from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cargarDatos } from "../scripts/cargar-datos.ts";
import { leerDatos } from "../scripts/datos.ts";
import { abrirTransaccion, deshacerTransaccion } from "./base.ts";

// Spec 001, T010. RF-012: la carga se repite sin duplicar productos y sin pisar el stock.

describe("carga de los datos de prueba", () => {
  let cliente: pg.Client;

  beforeEach(async () => {
    cliente = await abrirTransaccion();
  });

  afterEach(async () => {
    await deshacerTransaccion(cliente);
  });

  async function contar(tabla: string): Promise<number> {
    const { rows } = await cliente.query<{ total: number }>(
      `select count(*)::int as total from inventario.${tabla}`,
    );
    return rows[0]!.total;
  }

  async function stockDe(codigo: string): Promise<{ disponible: number; version: number }> {
    const { rows } = await cliente.query<{ disponible: number; version: string }>(
      `select s.disponible, s.version
         from inventario.stock s
         join inventario.productos p on p.id = s.producto_id
        where p.codigo = $1`,
      [codigo],
    );
    return { disponible: rows[0]!.disponible, version: Number(rows[0]!.version) };
  }

  it("deja las 12 categorías y los 1.500 productos, cada uno con su stock", async () => {
    const datos = await leerDatos();

    await cargarDatos(cliente, datos);

    expect(await contar("categorias")).toBe(12);
    expect(await contar("productos")).toBe(1500);
    expect(await contar("stock")).toBe(1500);
    const { rows } = await cliente.query(
      `select p.nombre, p.nombre_busqueda, p.descripcion, p.precio_centavos, p.foto_ruta,
              p.categoria_id, p.activo, s.disponible
         from inventario.productos p
         join inventario.stock s on s.producto_id = p.id
        where p.codigo = 'SUP-0001'`,
    );
    const primero = datos.productos[0]!;
    expect(rows[0]).toEqual({
      nombre: primero.nombre,
      nombre_busqueda: "limon verde valle 250 g",
      descripcion: primero.descripcion,
      precio_centavos: primero.precio_centavos,
      foto_ruta: "SUP-0001.webp",
      categoria_id: 1,
      activo: true,
      disponible: primero.stock_inicial,
    });
  });

  it("cargar dos veces no duplica y actualiza los datos del producto", async () => {
    const datos = await leerDatos();
    await cargarDatos(cliente, datos);
    await cliente.query(
      "update inventario.productos set nombre = 'Otro nombre', precio_centavos = 1 where codigo = 'SUP-0001'",
    );

    await cargarDatos(cliente, datos);

    expect(await contar("categorias")).toBe(12);
    expect(await contar("productos")).toBe(1500);
    expect(await contar("stock")).toBe(1500);
    const { rows } = await cliente.query(
      "select nombre, precio_centavos from inventario.productos where codigo = 'SUP-0001'",
    );
    expect(rows[0]).toEqual({
      nombre: datos.productos[0]!.nombre,
      precio_centavos: datos.productos[0]!.precio_centavos,
    });
  });

  it("repetir la carga no pisa el stock vivo", async () => {
    const datos = await leerDatos();
    await cargarDatos(cliente, datos);
    await cliente.query(
      `update inventario.stock set disponible = 3, version = version + 1
        where producto_id = (select id from inventario.productos where codigo = 'SUP-0001')`,
    );
    const antes = await stockDe("SUP-0001");

    await cargarDatos(cliente, datos);

    expect(await stockDe("SUP-0001")).toEqual(antes);
  });

  it("con reiniciarStock vuelve al stock inicial y sube la versión", async () => {
    const datos = await leerDatos();
    await cargarDatos(cliente, datos);
    await cliente.query(
      `update inventario.stock set disponible = 3, version = version + 1
        where producto_id = (select id from inventario.productos where codigo = 'SUP-0001')`,
    );
    const antes = await stockDe("SUP-0001");

    await cargarDatos(cliente, datos, { reiniciarStock: true });

    const despues = await stockDe("SUP-0001");
    expect(despues.disponible).toBe(datos.productos[0]!.stock_inicial);
    expect(despues.version).toBeGreaterThan(antes.version);
  });
});
