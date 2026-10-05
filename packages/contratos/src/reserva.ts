import { z } from "zod";
import { MAXIMO_LINEAS, precioCentavos, productoId } from "./comun.ts";

/**
 * `PUT /reserva`. Una cantidad mayor que el tope no es un error: se reserva hasta
 * el tope y la línea vuelve con motivo `tope`.
 */
export const peticionReserva = z.object({
  lineas: z
    .array(z.object({ producto_id: productoId, cantidad: z.int().min(1).max(100) }))
    .min(1)
    .max(MAXIMO_LINEAS),
});
export type PeticionReserva = z.infer<typeof peticionReserva>;

export const motivoAjuste = z.enum(["stock", "tope", "agotado", "retirado"]);
export type MotivoAjuste = z.infer<typeof motivoAjuste>;

export const lineaReservada = z.object({
  producto_id: productoId,
  nombre: z.string(),
  pedida: z.int().positive(),
  reservada: z.int().nonnegative(),
  precio_centavos: precioCentavos,
  motivo: motivoAjuste.nullable(),
});
export type LineaReservada = z.infer<typeof lineaReservada>;

export const respuestaReserva = z.object({
  lineas: z.array(lineaReservada),
  senal_cada_segundos: z.int().positive(),
});
export type RespuestaReserva = z.infer<typeof respuestaReserva>;
