import { describe, expect, it } from "vitest";
import {
  cuenta,
  peticionCuenta,
  peticionRegistro,
  peticionSesion,
  sesionIniciada,
} from "../src/index.ts";

const usuario = {
  id: "3f2b8c1e-5d4a-4c7b-9e1f-2a6b7c8d9e0f",
  nombre: "Ana Pérez",
  correo: "ana@ejemplo.com",
  telefono: null,
  direccion: null,
};

describe("cuentas y sesión", () => {
  it("el registro aplica las reglas de nombre, correo y contraseña", () => {
    const registro = { nombre: "Ana", correo: "Ana@Ejemplo.com", contrasena: "abcd1234" };
    expect(peticionRegistro.parse(registro).correo).toBe("ana@ejemplo.com");
    expect(peticionRegistro.safeParse({ ...registro, contrasena: "abcdefgh" }).success).toBe(false);
    expect(peticionRegistro.safeParse({ ...registro, nombre: "" }).success).toBe(false);
  });

  it("el inicio de sesión no aplica la regla de la contraseña, solo la exige", () => {
    const acceso = { correo: "ana@ejemplo.com", contrasena: "x" };
    expect(peticionSesion.safeParse(acceso).success).toBe(true);
    expect(peticionSesion.safeParse({ ...acceso, contrasena: "" }).success).toBe(false);
  });

  it("la cuenta puede no tener teléfono ni dirección", () => {
    expect(cuenta.parse(usuario)).toEqual(usuario);
  });

  it("la sesión iniciada trae el usuario y los dos tokens", () => {
    const sesion = { usuario, token_acceso: "a.b.c", expira_en: 900, token_renovacion: "abc" };
    expect(sesionIniciada.parse(sesion)).toEqual(sesion);
  });

  it("al editar la cuenta los campos son opcionales, el correo se descarta y los máximos valen", () => {
    expect(peticionCuenta.parse({ telefono: "0999999999", correo: "otro@ejemplo.com" })).toEqual({
      telefono: "0999999999",
    });
    expect(peticionCuenta.safeParse({ telefono: "1".repeat(21) }).success).toBe(false);
    expect(peticionCuenta.safeParse({ direccion: "a".repeat(201) }).success).toBe(false);
  });
});
