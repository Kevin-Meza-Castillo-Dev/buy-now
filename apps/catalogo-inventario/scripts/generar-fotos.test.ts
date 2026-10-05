import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generarDatos } from "./generar-datos.ts";
import { generarFotos } from "./generar-fotos.ts";

// Spec 001, T012. RF-012: cada producto tiene su foto.
describe("generarFotos", () => {
  const datos = generarDatos();
  // Un producto de cada categoría: basta para comprobar el formato sin dibujar las 1.500.
  const muestra = {
    ...datos,
    productos: datos.productos.filter((_, indice) => indice % 125 === 0),
  };
  let carpeta: string;

  beforeAll(async () => {
    carpeta = await mkdtemp(join(tmpdir(), "buy-now-fotos-"));
    await generarFotos(muestra, carpeta);
  });

  afterAll(async () => {
    await rm(carpeta, { recursive: true, force: true });
  });

  it("escribe una imagen por producto, con el nombre de su foto_ruta", async () => {
    const archivos = (await readdir(carpeta)).sort();

    expect(archivos).toEqual(muestra.productos.map((producto) => producto.foto_ruta).sort());
  });

  it("cada imagen es WebP de 480 × 480", async () => {
    for (const producto of muestra.productos) {
      // Se lee a memoria para que sharp no deje el archivo abierto y se pueda borrar.
      const imagen = await sharp(await readFile(join(carpeta, producto.foto_ruta))).metadata();

      expect(imagen.format, producto.codigo).toBe("webp");
      expect(imagen.width, producto.codigo).toBe(480);
      expect(imagen.height, producto.codigo).toBe(480);
    }
  });
});
