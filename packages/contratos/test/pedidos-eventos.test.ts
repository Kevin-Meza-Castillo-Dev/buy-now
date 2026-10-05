import { describe, expect, it } from "vitest";
import {
  errorStockInsuficiente,
  eventoPedidoConfirmado,
  eventoStockCambiado,
  pedido,
  peticionPedido,
  respuestaPedidos,
} from "../src/index.ts";

const unPedido = {
  id: "3f2b8c1e-5d4a-4c7b-9e1f-2a6b7c8d9e0f",
  numero: "PED-2026-000123",
  creado_en: "2026-10-04T15:00:00Z",
  nombre: "Ana Pérez",
  correo: "ana@ejemplo.com",
  telefono: null,
  direccion: "Av. Siempre Viva 123",
  nota: null,
  lineas: [
    { producto_id: 1, nombre: "Limón", cantidad: 2, precio_centavos: 150, importe_centavos: 300 },
  ],
  unidades: 2,
  total_centavos: 300,
};

describe("pedidos", () => {
  it("confirmar exige nombre y dirección; teléfono y nota son opcionales", () => {
    expect(peticionPedido.safeParse({ nombre: "Ana", direccion: "Av. 1" }).success).toBe(true);
    expect(peticionPedido.safeParse({ nombre: "Ana", direccion: "" }).success).toBe(false);
    expect(peticionPedido.safeParse({ nombre: "", direccion: "Av. 1" }).success).toBe(false);
    expect(peticionPedido.safeParse({ nombre: "Ana", direccion: "a".repeat(201) }).success).toBe(
      false,
    );
  });

  it("el pedido lleva su número con el formato PED-AAAA-NNNNNN", () => {
    expect(pedido.parse(unPedido)).toEqual(unPedido);
    expect(pedido.safeParse({ ...unPedido, numero: "PED-2026-1234567" }).success).toBe(true);
    expect(pedido.safeParse({ ...unPedido, numero: "123" }).success).toBe(false);
  });

  it("la lista trae el cursor siguiente, o nulo si no hay más", () => {
    const resumen = {
      id: unPedido.id,
      numero: unPedido.numero,
      creado_en: unPedido.creado_en,
      productos: 1,
      unidades: 2,
      total_centavos: 300,
    };
    expect(respuestaPedidos.safeParse({ pedidos: [resumen], siguiente: null }).success).toBe(true);
    expect(respuestaPedidos.safeParse({ pedidos: [resumen], siguiente: "122" }).success).toBe(true);
  });

  it("el error de stock insuficiente trae los afectados", () => {
    const cuerpo = {
      codigo: "stock_insuficiente",
      mensaje: "Algunos productos ya no alcanzan.",
      afectados: [{ producto_id: 1, nombre: "Limón", pedida: 3, disponible: 1 }],
    };
    expect(errorStockInsuficiente.parse(cuerpo)).toEqual(cuerpo);
  });
});

describe("eventos", () => {
  const sobre = { id: unPedido.id, ocurrido_en: "2026-10-04T15:00:00Z" };

  it("stock-cambiado lleva producto, disponible, versión y motivo", () => {
    const evento = {
      ...sobre,
      tipo: "inventario.stock-cambiado.v1",
      datos: { producto_id: 1, disponible: 9, version: 4, motivo: "reserva" },
    };
    expect(eventoStockCambiado.parse(evento)).toEqual(evento);
    expect(eventoStockCambiado.safeParse({ ...evento, tipo: "otro" }).success).toBe(false);
    const negativo = { ...evento, datos: { ...evento.datos, disponible: -1 } };
    expect(eventoStockCambiado.safeParse(negativo).success).toBe(false);
  });

  it("pedido-confirmado lleva el pedido completo y su usuario", () => {
    const evento = {
      ...sobre,
      tipo: "pedidos.pedido-confirmado.v1",
      datos: { ...unPedido, usuario_id: unPedido.id },
    };
    expect(eventoPedidoConfirmado.parse(evento)).toEqual(evento);
    expect(eventoPedidoConfirmado.safeParse({ ...evento, datos: unPedido }).success).toBe(false);
  });
});
