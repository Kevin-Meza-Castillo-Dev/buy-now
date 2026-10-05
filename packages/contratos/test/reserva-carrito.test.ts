import { describe, expect, it } from "vitest";
import {
  lineaReservada,
  peticionAgregar,
  peticionGuardarCarrito,
  peticionReserva,
  respuestaReserva,
} from "../src/index.ts";

const reservar = (cantidad: number) =>
  peticionReserva.safeParse({ lineas: [{ producto_id: 1, cantidad }] }).success;

describe("reserva", () => {
  it("se pide con 1 a 100 líneas; una cantidad sobre 20 no es un error del contrato", () => {
    expect(reservar(25)).toBe(true);
    expect(reservar(0)).toBe(false);
    expect(reservar(101)).toBe(false);
    expect(peticionReserva.safeParse({ lineas: [] }).success).toBe(false);
  });

  it("cada línea reservada trae lo pedido, lo reservado, el precio y el motivo del ajuste", () => {
    const linea = {
      producto_id: 1,
      nombre: "Limón",
      pedida: 3,
      reservada: 2,
      precio_centavos: 150,
    };
    expect(lineaReservada.safeParse({ ...linea, motivo: "stock" }).success).toBe(true);
    expect(lineaReservada.safeParse({ ...linea, reservada: 3, motivo: null }).success).toBe(true);
    expect(lineaReservada.safeParse({ ...linea, motivo: "otro" }).success).toBe(false);
  });

  it("la respuesta indica cada cuántos segundos va la señal", () => {
    expect(respuestaReserva.safeParse({ lineas: [], senal_cada_segundos: 30 }).success).toBe(true);
  });
});

describe("carrito", () => {
  it("se agrega de 1 a 20 unidades", () => {
    expect(peticionAgregar.safeParse({ producto_id: 1, cantidad: 20 }).success).toBe(true);
    expect(peticionAgregar.safeParse({ producto_id: 1, cantidad: 21 }).success).toBe(false);
    expect(peticionAgregar.safeParse({ producto_id: 1, cantidad: 0 }).success).toBe(false);
  });

  it("se guarda con 0 a 100 líneas y cantidades de 1 a 20", () => {
    const linea = { producto_id: 1, cantidad: 2, precio_visto_centavos: 150 };
    const guardar = (lineas: unknown[]) => peticionGuardarCarrito.safeParse({ lineas }).success;
    expect(guardar([])).toBe(true);
    expect(guardar([linea])).toBe(true);
    expect(guardar([{ ...linea, cantidad: 21 }])).toBe(false);
    expect(guardar(Array.from({ length: 101 }, (_, i) => ({ ...linea, producto_id: i + 1 })))).toBe(
      false,
    );
  });
});
