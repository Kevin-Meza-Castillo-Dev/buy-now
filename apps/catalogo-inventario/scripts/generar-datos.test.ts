import { describe, expect, it } from "vitest";
import { leerDatos } from "./datos.ts";
import { generarDatos } from "./generar-datos.ts";

// Spec 001, T008. RF-012: un conjunto fijo de 1.500 productos con todos sus campos llenos.

const CATEGORIAS = [
  "Frutas y verduras",
  "Carnes y pescados",
  "Lácteos y huevos",
  "Panadería",
  "Despensa",
  "Bebidas",
  "Snacks y dulces",
  "Congelados",
  "Limpieza del hogar",
  "Cuidado personal",
  "Bebés",
  "Mascotas",
];

describe("generarDatos", () => {
  const datos = generarDatos();

  it("trae las 12 categorías, en su orden", () => {
    expect(datos.categorias.map((categoria) => categoria.nombre)).toEqual(CATEGORIAS);
    expect(datos.categorias.map((categoria) => categoria.orden)).toEqual(
      CATEGORIAS.map((_, indice) => indice + 1),
    );
    expect(new Set(datos.categorias.map((categoria) => categoria.id)).size).toBe(12);
  });

  it("trae 125 productos en cada categoría, 1.500 en total", () => {
    expect(datos.productos).toHaveLength(1500);
    for (const categoria of datos.categorias) {
      const suyos = datos.productos.filter((producto) => producto.categoria_id === categoria.id);
      expect(suyos, categoria.nombre).toHaveLength(125);
    }
  });

  it("llena todos los campos de cada producto", () => {
    for (const producto of datos.productos) {
      expect(producto.codigo).toMatch(/^SUP-\d{4}$/);
      expect(producto.nombre.trim()).not.toBe("");
      expect(producto.descripcion.trim()).not.toBe("");
      expect(Number.isInteger(producto.precio_centavos)).toBe(true);
      expect(producto.precio_centavos).toBeGreaterThan(0);
      expect(producto.foto_ruta).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*\.webp$/);
      expect(producto.activo).toBe(true);
      expect(Number.isInteger(producto.stock_inicial)).toBe(true);
      expect(producto.stock_inicial).toBeGreaterThanOrEqual(0);
    }
  });

  it("da una foto a cada tipo de producto, que comparten sus 5 presentaciones", () => {
    const porFoto = new Map<string, number>();
    for (const producto of datos.productos) {
      porFoto.set(producto.foto_ruta, (porFoto.get(producto.foto_ruta) ?? 0) + 1);
    }

    expect(porFoto.size).toBe(300);
    expect([...porFoto.values()].every((veces) => veces === 5)).toBe(true);
    expect(datos.productos[0]!.foto_ruta).toBe("limon.webp");
    expect(datos.productos[125]!.foto_ruta).toBe("pechuga-de-pollo.webp");
  });

  it("no repite códigos ni nombres", () => {
    expect(new Set(datos.productos.map((producto) => producto.codigo)).size).toBe(1500);
    expect(new Set(datos.productos.map((producto) => producto.nombre)).size).toBe(1500);
  });

  it("cubre los tres estados de stock: cerca de 70 % con más de 5, 20 % entre 1 y 5 y 10 % en 0", () => {
    const porcentaje = (cumple: (stock: number) => boolean) =>
      (datos.productos.filter((producto) => cumple(producto.stock_inicial)).length / 1500) * 100;

    expect(porcentaje((stock) => stock > 5)).toBeCloseTo(70, -1);
    expect(porcentaje((stock) => stock >= 1 && stock <= 5)).toBeCloseTo(20, -1);
    expect(porcentaje((stock) => stock === 0)).toBeCloseTo(10, -1);
  });

  it("da el mismo resultado en cada corrida", () => {
    expect(generarDatos()).toEqual(datos);
  });

  it("coincide con el archivo datos/productos.json guardado en el repositorio", async () => {
    expect(await leerDatos()).toEqual(datos);
  });
});
