import { describe, expect, it } from "vitest";
import {
  consultaProductos,
  consultaStock,
  productoDetalle,
  productoResumen,
} from "../src/index.ts";

const resumen = {
  id: 1,
  nombre: "Limón",
  precio_centavos: 150,
  foto_url: "/fotos/SUP-0001.webp",
  categoria_id: 3,
  stock_visible: 12,
};

describe("catálogo", () => {
  it("un producto de la lista lleva nombre, precio, foto, categoría y stock visible", () => {
    expect(productoResumen.parse(resumen)).toEqual(resumen);
    expect(productoResumen.safeParse({ ...resumen, precio_centavos: 0 }).success).toBe(false);
    expect(productoResumen.safeParse({ ...resumen, stock_visible: -1 }).success).toBe(false);
  });

  it("el detalle añade la descripción y la categoría", () => {
    const detalle = {
      ...resumen,
      descripcion: "Limón fresco.",
      categoria: { id: 3, nombre: "Frutas" },
    };
    expect(productoDetalle.parse(detalle)).toEqual(detalle);
    expect(productoDetalle.safeParse(resumen).success).toBe(false);
  });

  it("la consulta de productos lee los parámetros de la URL y empieza en la página 1", () => {
    expect(consultaProductos.parse({})).toEqual({ pagina: 1 });
    expect(consultaProductos.parse({ buscar: " limon ", categoria: "3", pagina: "2" })).toEqual({
      buscar: "limon",
      categoria: 3,
      pagina: 2,
    });
    expect(consultaProductos.safeParse({ pagina: "0" }).success).toBe(false);
    expect(consultaProductos.safeParse({ buscar: "a".repeat(61) }).success).toBe(false);
  });

  it("la consulta de stock acepta de 1 a 50 ids separados por coma", () => {
    expect(consultaStock.parse({ ids: "1,2,3" })).toEqual({ ids: [1, 2, 3] });
    const cincuentaYUno = Array.from({ length: 51 }, (_, i) => i + 1).join(",");
    expect(consultaStock.safeParse({ ids: cincuentaYUno }).success).toBe(false);
    expect(consultaStock.safeParse({ ids: "" }).success).toBe(false);
    expect(consultaStock.safeParse({ ids: "1,abc" }).success).toBe(false);
  });
});
