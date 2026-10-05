import { describe, expect, it } from "vitest";
import {
  centavos,
  claveIdempotencia,
  contrasena,
  correo,
  error,
  nombre,
  nota,
} from "../src/index.ts";

describe("reglas de validación", () => {
  it("acepta un correo válido y lo deja sin espacios y en minúsculas", () => {
    expect(correo.parse("  Ana.Perez@Ejemplo.COM ")).toBe("ana.perez@ejemplo.com");
  });

  it("rechaza un correo sin formato válido o de más de 254 caracteres", () => {
    expect(correo.safeParse("ana@").success).toBe(false);
    expect(correo.safeParse("sin-arroba.com").success).toBe(false);
    expect(correo.safeParse("a".repeat(250) + "@b.co").success).toBe(false);
  });

  it("exige en la contraseña de 8 a 128 caracteres, con letra y número", () => {
    expect(contrasena.safeParse("abcd1234").success).toBe(true);
    expect(contrasena.safeParse("abc1234").success).toBe(false);
    expect(contrasena.safeParse("abcdefgh").success).toBe(false);
    expect(contrasena.safeParse("12345678").success).toBe(false);
    expect(contrasena.safeParse("a1" + "x".repeat(127)).success).toBe(false);
  });

  it("exige un nombre de 1 a 100 caracteres, sin contar los espacios de los lados", () => {
    expect(nombre.parse("  Ana  ")).toBe("Ana");
    expect(nombre.safeParse("   ").success).toBe(false);
    expect(nombre.safeParse("a".repeat(101)).success).toBe(false);
  });

  it("limita la nota a 300 caracteres", () => {
    expect(nota.safeParse("a".repeat(300)).success).toBe(true);
    expect(nota.safeParse("a".repeat(301)).success).toBe(false);
  });
});

describe("convenciones comunes", () => {
  it("el dinero va en centavos enteros y no negativos", () => {
    expect(centavos.safeParse(1250).success).toBe(true);
    expect(centavos.safeParse(12.5).success).toBe(false);
    expect(centavos.safeParse(-1).success).toBe(false);
  });

  it("la clave de idempotencia es un UUID", () => {
    expect(claveIdempotencia.safeParse("3f2b8c1e-5d4a-4c7b-9e1f-2a6b7c8d9e0f").success).toBe(true);
    expect(claveIdempotencia.safeParse("abc").success).toBe(false);
  });

  it("el error lleva código y mensaje, y los campos solo cuando los hay", () => {
    const conCampos = {
      codigo: "datos_invalidos",
      mensaje: "Revisa los campos marcados.",
      campos: { correo: "El correo no es válido." },
    };
    expect(error.parse(conCampos)).toEqual(conCampos);
    expect(
      error.safeParse({ codigo: "carrito_vacio", mensaje: "Tu carrito está vacío." }).success,
    ).toBe(true);
    expect(error.safeParse({ codigo: "otro_codigo", mensaje: "x" }).success).toBe(false);
  });
});
