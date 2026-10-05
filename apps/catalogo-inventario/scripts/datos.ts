import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export type CategoriaDePrueba = {
  id: number;
  nombre: string;
  orden: number;
};

export type ProductoDePrueba = {
  codigo: string;
  nombre: string;
  descripcion: string;
  precio_centavos: number;
  foto_ruta: string;
  categoria_id: number;
  activo: boolean;
  stock_inicial: number;
};

export type DatosDePrueba = {
  categorias: CategoriaDePrueba[];
  productos: ProductoDePrueba[];
};

export const ARCHIVO_DE_DATOS = fileURLToPath(new URL("../datos/productos.json", import.meta.url));

// El conjunto fijo de RF-012, tal como está guardado en el repositorio.
export async function leerDatos(): Promise<DatosDePrueba> {
  return JSON.parse(await readFile(ARCHIVO_DE_DATOS, "utf8")) as DatosDePrueba;
}
