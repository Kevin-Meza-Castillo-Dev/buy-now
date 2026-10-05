import { z } from "zod";
import { contrasena, correo, direccion, error, nombre, telefono, usuarioId } from "./comun.ts";

/** `POST /cuentas` */
export const peticionRegistro = z.object({ nombre, correo, contrasena });
export type PeticionRegistro = z.infer<typeof peticionRegistro>;

/** `POST /sesiones`. La regla de la contraseña solo se aplica al registrarse. */
export const peticionSesion = z.object({
  correo,
  contrasena: z.string().min(1).max(128),
});
export type PeticionSesion = z.infer<typeof peticionSesion>;

/** `POST /sesiones/renovar` */
export const peticionRenovar = z.object({ token_renovacion: z.string().min(1) });
export type PeticionRenovar = z.infer<typeof peticionRenovar>;

export const respuestaRenovar = z.object({
  token_acceso: z.string(),
  expira_en: z.int().positive(),
});
export type RespuestaRenovar = z.infer<typeof respuestaRenovar>;

export const cuenta = z.object({
  id: usuarioId,
  nombre: z.string(),
  correo: z.string(),
  telefono: z.string().nullable(),
  direccion: z.string().nullable(),
});
export type Cuenta = z.infer<typeof cuenta>;

export const sesionIniciada = z.object({
  usuario: cuenta,
  token_acceso: z.string(),
  expira_en: z.int().positive(),
  token_renovacion: z.string(),
});
export type SesionIniciada = z.infer<typeof sesionIniciada>;

/** `PATCH /cuenta`. El correo no se edita: si llega, se descarta. */
export const peticionCuenta = z.object({
  nombre: nombre.optional(),
  telefono: telefono.optional(),
  direccion: direccion.optional(),
});
export type PeticionCuenta = z.infer<typeof peticionCuenta>;

/** 429 de `POST /sesiones` */
export const errorAccesoBloqueado = error.extend({
  codigo: z.literal("acceso_bloqueado"),
  reintentar_en_segundos: z.int().positive(),
});
export type ErrorAccesoBloqueado = z.infer<typeof errorAccesoBloqueado>;
