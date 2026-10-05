import type pg from "pg";
import { normalizarNombre } from "../src/catalogo/normalizar-nombre.ts";

// Filas mínimas para las pruebas del catálogo. Cada prueba inserta solo lo que necesita.

export async function insertarCategoria(
  cliente: pg.Client,
  categoria: { id: number; nombre: string; orden: number },
): Promise<void> {
  await cliente.query("insert into inventario.categorias (id, nombre, orden) values ($1, $2, $3)", [
    categoria.id,
    categoria.nombre,
    categoria.orden,
  ]);
}

let consecutivo = 0;

// Inserta un producto con su stock y devuelve su id.
export async function insertarProducto(
  cliente: pg.Client,
  producto: {
    nombre: string;
    categoria_id: number;
    precio_centavos?: number;
    descripcion?: string;
    foto_ruta?: string;
    activo?: boolean;
    disponible?: number;
  },
): Promise<number> {
  consecutivo += 1;
  const { rows } = await cliente.query<{ id: number }>(
    `insert into inventario.productos
       (codigo, nombre, nombre_busqueda, descripcion, precio_centavos, foto_ruta, categoria_id, activo)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [
      `PRUEBA-${consecutivo}`,
      producto.nombre,
      normalizarNombre(producto.nombre),
      producto.descripcion ?? "Descripción de prueba.",
      producto.precio_centavos ?? 100,
      producto.foto_ruta ?? "limon.webp",
      producto.categoria_id,
      producto.activo ?? true,
    ],
  );
  const id = rows[0]!.id;
  await cliente.query("insert into inventario.stock (producto_id, disponible) values ($1, $2)", [
    id,
    producto.disponible ?? 10,
  ]);
  return id;
}
