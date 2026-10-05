import type pg from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abrirTransaccion, deshacerTransaccion, rechazo } from "./base.ts";

// Spec 001, T004. Restricciones del esquema `inventario` (principio I: el stock
// nunca queda negativo).

const VIOLACION_DE_UNICO = "23505";
const VIOLACION_DE_CHECK = "23514";
const CATEGORIA = 32000;

const INSERTAR_PRODUCTO = `
  insert into inventario.productos
    (codigo, nombre, nombre_busqueda, descripcion, precio_centavos, foto_ruta, categoria_id)
  values ($1, 'Limón', 'limon', 'Limón fresco', $2, 'PRUEBA.webp', ${CATEGORIA})
  returning id`;

describe("restricciones del esquema inventario", () => {
  let cliente: pg.Client;

  beforeEach(async () => {
    cliente = await abrirTransaccion();
    await cliente.query(
      "insert into inventario.categorias (id, nombre, orden) values ($1, 'Categoría de prueba', 1)",
      [CATEGORIA],
    );
  });

  afterEach(async () => {
    await deshacerTransaccion(cliente);
  });

  async function crearProducto(codigo: string): Promise<number> {
    const { rows } = await cliente.query<{ id: number }>(INSERTAR_PRODUCTO, [codigo, 150]);
    return rows[0]!.id;
  }

  it("no acepta dos productos con el mismo codigo", async () => {
    await crearProducto("PRUEBA-0001");

    const error = await rechazo(cliente, INSERTAR_PRODUCTO, ["PRUEBA-0001", 150]);

    expect(error.code).toBe(VIOLACION_DE_UNICO);
    expect(error.constraint).toBe("productos_codigo_unique");
  });

  it.each([0, -1])("no acepta un producto con precio %i", async (precio) => {
    const error = await rechazo(cliente, INSERTAR_PRODUCTO, ["PRUEBA-0002", precio]);

    expect(error.code).toBe(VIOLACION_DE_CHECK);
    expect(error.constraint).toBe("productos_precio_positivo");
  });

  it("no acepta crear un stock negativo", async () => {
    const productoId = await crearProducto("PRUEBA-0003");

    const error = await rechazo(
      cliente,
      "insert into inventario.stock (producto_id, disponible) values ($1, -1)",
      [productoId],
    );

    expect(error.code).toBe(VIOLACION_DE_CHECK);
    expect(error.constraint).toBe("stock_disponible_no_negativo");
  });

  it("no deja bajar el stock de 0 y conserva el valor anterior", async () => {
    const productoId = await crearProducto("PRUEBA-0004");
    await cliente.query("insert into inventario.stock (producto_id, disponible) values ($1, 2)", [
      productoId,
    ]);

    const error = await rechazo(
      cliente,
      "update inventario.stock set disponible = disponible - 3 where producto_id = $1",
      [productoId],
    );

    expect(error.code).toBe(VIOLACION_DE_CHECK);
    expect(error.constraint).toBe("stock_disponible_no_negativo");
    const { rows } = await cliente.query<{ disponible: number }>(
      "select disponible from inventario.stock where producto_id = $1",
      [productoId],
    );
    expect(rows[0]!.disponible).toBe(2);
  });
});
