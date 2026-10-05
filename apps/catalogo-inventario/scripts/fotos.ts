import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { normalizarNombre } from "../src/catalogo/normalizar-nombre.ts";

// Las fotos de los productos de prueba (RF-012): una foto real por tipo de producto,
// tomada de Wikimedia Commons, que comparten sus presentaciones.

export type FotoDePrueba = {
  // Nombre del archivo en fotos/; es la foto_ruta de los productos de ese tipo.
  archivo: string;
  producto: string;
  // Archivo de Wikimedia Commons del que sale.
  titulo: string;
  autor: string;
  licencia: string;
  licencia_url: string;
  fuente: string;
};

export const ARCHIVO_DE_FOTOS = fileURLToPath(new URL("../datos/fotos.json", import.meta.url));
export const CARPETA_DE_FOTOS = fileURLToPath(new URL("../fotos", import.meta.url));

// Solo se admiten dominio público, CC0, CC BY y CC BY-SA.
export const LICENCIA_LIBRE = /^(CC0|CC BY(-SA)? \d|Public domain|PD)/i;

// "Pechuga de pollo" → "pechuga-de-pollo.webp"
export function archivoDeFoto(producto: string): string {
  const nombre = normalizarNombre(producto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${nombre}.webp`;
}

export async function leerFotos(): Promise<FotoDePrueba[]> {
  return JSON.parse(await readFile(ARCHIVO_DE_FOTOS, "utf8")) as FotoDePrueba[];
}
