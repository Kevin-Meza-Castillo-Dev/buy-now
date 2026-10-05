import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { recortarFoto } from "./descargar-fotos.ts";
import { CARPETA_DE_FOTOS, leerFotos, LICENCIA_LIBRE } from "./fotos.ts";
import { generarDatos } from "./generar-datos.ts";

// Spec 001, T012. RF-012: cada producto tiene una foto real, con licencia libre y su atribución.

describe("fotos de los productos de prueba", () => {
  const rutas = [...new Set(generarDatos().productos.map((producto) => producto.foto_ruta))].sort();

  it("datos/fotos.json tiene una entrada por cada foto de los productos, y ninguna de más", async () => {
    const fotos = await leerFotos();

    expect(fotos.map((foto) => foto.archivo).sort()).toEqual(rutas);
  });

  it("cada foto dice su autor, su licencia libre y su fuente en Wikimedia Commons", async () => {
    for (const foto of await leerFotos()) {
      expect(foto.producto.trim(), foto.archivo).not.toBe("");
      expect(foto.titulo, foto.archivo).toMatch(/^File:/);
      expect(foto.autor.trim(), foto.archivo).not.toBe("");
      expect(foto.licencia, foto.archivo).toMatch(LICENCIA_LIBRE);
      expect(foto.fuente, foto.archivo).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    }
  });

  it("ninguna foto se repite entre dos productos", async () => {
    const titulos = (await leerFotos()).map((foto) => foto.titulo);

    expect(titulos.filter((titulo, indice) => titulos.indexOf(titulo) !== indice)).toEqual([]);
  });

  it("la carpeta fotos/ tiene un archivo por cada foto, y ninguno de más", async () => {
    expect((await readdir(CARPETA_DE_FOTOS)).sort()).toEqual(rutas);
  });

  it("cada archivo es WebP de 480 × 480", async () => {
    for (const ruta of rutas) {
      const imagen = await sharp(await readFile(join(CARPETA_DE_FOTOS, ruta))).metadata();

      expect(imagen.format, ruta).toBe("webp");
      expect(imagen.width, ruta).toBe(480);
      expect(imagen.height, ruta).toBe(480);
    }
  });
});

describe("recortarFoto", () => {
  it("convierte una foto de cualquier proporción en WebP de 480 × 480", async () => {
    const original = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: "#C0392B" },
    })
      .jpeg()
      .toBuffer();

    const imagen = await sharp(await recortarFoto(original)).metadata();

    expect(imagen.format).toBe("webp");
    expect(imagen.width).toBe(480);
    expect(imagen.height).toBe(480);
  });
});
