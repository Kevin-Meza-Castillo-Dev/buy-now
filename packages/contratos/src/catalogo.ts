import { z } from "zod";
import { precioCentavos, productoId } from "./comun.ts";

export const categoria = z.object({
  id: z.int().positive(),
  nombre: z.string(),
});
export type Categoria = z.infer<typeof categoria>;

export const productoResumen = z.object({
  id: productoId,
  nombre: z.string(),
  precio_centavos: precioCentavos,
  foto_url: z.string(),
  categoria_id: z.int().positive(),
  stock_visible: z.int().nonnegative(),
});
export type ProductoResumen = z.infer<typeof productoResumen>;

export const productoDetalle = productoResumen.extend({
  descripcion: z.string(),
  categoria,
});
export type ProductoDetalle = z.infer<typeof productoDetalle>;

/** `GET /categorias` */
export const respuestaCategorias = z.object({ categorias: z.array(categoria) });

/** `GET /productos?buscar=&categoria=&pagina=` */
export const consultaProductos = z.object({
  buscar: z.string().trim().max(60).optional(),
  categoria: z.coerce.number().int().positive().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});
export type ConsultaProductos = z.infer<typeof consultaProductos>;

export const respuestaProductos = z.object({
  productos: z.array(productoResumen),
  pagina: z.int().min(1),
  hay_mas: z.boolean(),
});
export type RespuestaProductos = z.infer<typeof respuestaProductos>;

/** `GET /stock?ids=1,2,3` */
export const consultaStock = z.object({
  ids: z
    .string()
    .transform((ids) => ids.split(",").map(Number))
    .pipe(z.array(productoId).min(1).max(50)),
});
export type ConsultaStock = z.infer<typeof consultaStock>;

export const respuestaStock = z.object({
  stock: z.array(z.object({ producto_id: productoId, disponible: z.int().nonnegative() })),
});
export type RespuestaStock = z.infer<typeof respuestaStock>;
