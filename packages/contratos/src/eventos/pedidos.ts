import { z } from "zod";
import { usuarioId } from "../comun.ts";
import { pedido } from "../pedidos.ts";
import { sobre } from "./sobre.ts";

export const TOPIC_PEDIDOS = "pedidos.eventos";
export const TIPO_PEDIDO_CONFIRMADO = "pedidos.pedido-confirmado.v1";

/** La clave del mensaje es el `id` del pedido. No lleva contraseñas ni tokens. */
export const pedidoConfirmado = pedido.extend({ usuario_id: usuarioId });
export type PedidoConfirmado = z.infer<typeof pedidoConfirmado>;

export const eventoPedidoConfirmado = sobre(TIPO_PEDIDO_CONFIRMADO, pedidoConfirmado);
export type EventoPedidoConfirmado = z.infer<typeof eventoPedidoConfirmado>;
