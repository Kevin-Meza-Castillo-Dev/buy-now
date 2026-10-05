import { z } from "zod";
import { MAXIMO_LINEAS, TOPE_UNIDADES, error, precioCentavos, productoId } from "./comun.ts";

const cantidad = z.int().min(1).max(TOPE_UNIDADES);

export const lineaCarrito = z.object({
  producto_id: productoId,
  nombre: z.string(),
  foto_url: z.string(),
  cantidad,
  precio_centavos: precioCentavos,
  precio_visto_centavos: precioCentavos,
  activo: z.boolean(),
});
export type LineaCarrito = z.infer<typeof lineaCarrito>;

/** Respuesta de `GET /carrito`, `POST /carrito/lineas` y `PUT /carrito`. */
export const carrito = z.object({
  lineas: z.array(lineaCarrito),
  unidades: z.int().nonnegative(),
});
export type Carrito = z.infer<typeof carrito>;

/** `POST /carrito/lineas`: suma a la línea si ya existe. */
export const peticionAgregar = z.object({ producto_id: productoId, cantidad });
export type PeticionAgregar = z.infer<typeof peticionAgregar>;

/** `PUT /carrito`: deja el carrito igual a lo enviado. */
export const peticionGuardarCarrito = z.object({
  lineas: z
    .array(z.object({ producto_id: productoId, cantidad, precio_visto_centavos: precioCentavos }))
    .max(MAXIMO_LINEAS),
});
export type PeticionGuardarCarrito = z.infer<typeof peticionGuardarCarrito>;

/** 409 de `POST /carrito/lineas` */
export const errorTopeAlcanzado = error.extend({
  codigo: z.literal("tope_alcanzado"),
  maximo: z.int().positive(),
  en_carrito: z.int().nonnegative(),
});
export type ErrorTopeAlcanzado = z.infer<typeof errorTopeAlcanzado>;
