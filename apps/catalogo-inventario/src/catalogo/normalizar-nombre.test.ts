import { describe, expect, it } from "vitest";
import { normalizarNombre } from "./normalizar-nombre.ts";

// Spec 001, T006. RF-003, H3-E1: la búsqueda no distingue mayúsculas ni tildes.
describe("normalizarNombre", () => {
  it.each([
    ["Limón", "limon"],
    ["LIMÓN", "limon"],
    ["limon", "limon"],
    ["Plátano Maduro", "platano maduro"],
    ["Pingüino", "pinguino"],
    ["Jabón líquido 500 ml", "jabon liquido 500 ml"],
  ])("deja %s como %s", (nombre, esperado) => {
    expect(normalizarNombre(nombre)).toBe(esperado);
  });

  it("trata la ñ como n, igual en el nombre que en lo que escribe el cliente", () => {
    expect(normalizarNombre("Piña")).toBe(normalizarNombre("pina"));
  });

  it("quita los espacios de los extremos", () => {
    expect(normalizarNombre("  Leche  ")).toBe("leche");
  });
});
