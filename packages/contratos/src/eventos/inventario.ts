import { z } from "zod";
import { productoId } from "../comun.ts";
import { sobre } from "./sobre.ts";

export const TOPIC_INVENTARIO = "inventario.eventos";
export const TIPO_STOCK_CAMBIADO = "inventario.stock-cambiado.v1";

/** La clave del mensaje es `producto_id`. Quien consume descarta por `version`. */
export const stockCambiado = z.object({
  producto_id: productoId,
  disponible: z.int().nonnegative(),
  version: z.int().nonnegative(),
  motivo: z.enum(["reserva", "liberacion", "ajuste"]),
});
export type StockCambiado = z.infer<typeof stockCambiado>;

export const eventoStockCambiado = sobre(TIPO_STOCK_CAMBIADO, stockCambiado);
export type EventoStockCambiado = z.infer<typeof eventoStockCambiado>;
