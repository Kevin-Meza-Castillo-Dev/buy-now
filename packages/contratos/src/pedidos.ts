import { z } from "zod";
import {
  centavos,
  direccion,
  error,
  fecha,
  nombre,
  nota,
  pedidoId,
  precioCentavos,
  productoId,
  telefono,
} from "./comun.ts";

/** `POST /pedidos`. El correo sale de la cuenta, no de la petición. */
export const peticionPedido = z.object({
  nombre,
  direccion,
  telefono: telefono.optional(),
  nota: nota.optional(),
});
export type PeticionPedido = z.infer<typeof peticionPedido>;

export const numeroPedido = z.string().regex(/^PED-\d{4}-\d{6,}$/);

export const lineaPedido = z.object({
  producto_id: productoId,
  nombre: z.string(),
  cantidad: z.int().positive(),
  precio_centavos: precioCentavos,
  importe_centavos: centavos,
});
export type LineaPedido = z.infer<typeof lineaPedido>;

export const pedido = z.object({
  id: pedidoId,
  numero: numeroPedido,
  creado_en: fecha,
  nombre: z.string(),
  correo: z.string(),
  telefono: z.string().nullable(),
  direccion: z.string(),
  nota: z.string().nullable(),
  lineas: z.array(lineaPedido),
  unidades: z.int().positive(),
  total_centavos: centavos,
});
export type Pedido = z.infer<typeof pedido>;

export const pedidoResumen = z.object({
  id: pedidoId,
  numero: numeroPedido,
  creado_en: fecha,
  productos: z.int().positive(),
  unidades: z.int().positive(),
  total_centavos: centavos,
});
export type PedidoResumen = z.infer<typeof pedidoResumen>;

/** `GET /pedidos?antes=`. El cursor es el valor de `siguiente` de la página anterior. */
export const consultaPedidos = z.object({ antes: z.string().max(40).optional() });
export type ConsultaPedidos = z.infer<typeof consultaPedidos>;

export const respuestaPedidos = z.object({
  pedidos: z.array(pedidoResumen),
  siguiente: z.string().nullable(),
});
export type RespuestaPedidos = z.infer<typeof respuestaPedidos>;

export const afectado = z.object({
  producto_id: productoId,
  nombre: z.string(),
  pedida: z.int().positive(),
  disponible: z.int().nonnegative(),
});
export type Afectado = z.infer<typeof afectado>;

/** 409 de `POST /pedidos` cuando hubo que reservar de nuevo y no alcanzó. */
export const errorStockInsuficiente = error.extend({
  codigo: z.literal("stock_insuficiente"),
  afectados: z.array(afectado).min(1),
});
export type ErrorStockInsuficiente = z.infer<typeof errorStockInsuficiente>;
