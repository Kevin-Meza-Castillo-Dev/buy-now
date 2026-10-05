import { z } from "zod";

// Convenciones de specs/contratos.md: nombres en español, sin tildes y en snake_case;
// dinero en centavos enteros; fechas ISO 8601 en UTC.

export const TOPE_UNIDADES = 20;
export const TAMANO_PAGINA = 20;
export const MAXIMO_LINEAS = 100;

export const centavos = z.int().nonnegative();
export const precioCentavos = z.int().positive();
export const fecha = z.iso.datetime();
export const productoId = z.int().positive();
export const usuarioId = z.uuid();
export const pedidoId = z.uuid();

/** Cabecera `Idempotency-Key` de reservar y confirmar. */
export const claveIdempotencia = z.uuid();

// Reglas de validación. Valen igual en la app y en el servidor; decide el servidor.
export const correo = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const contrasena = z
  .string()
  .min(8)
  .max(128)
  .regex(/\p{L}/u, "Debe tener al menos una letra.")
  .regex(/\d/, "Debe tener al menos un número.");
export const nombre = z.string().trim().min(1).max(100);
export const telefono = z.string().trim().max(20);
export const direccion = z.string().trim().min(1).max(200);
export const nota = z.string().trim().max(300);

export const codigoError = z.enum([
  "datos_invalidos",
  "sesion_no_valida",
  "credenciales_incorrectas",
  "acceso_bloqueado",
  "demasiadas_peticiones",
  "correo_ya_registrado",
  "producto_no_encontrado",
  "pedido_no_encontrado",
  "tope_alcanzado",
  "reserva_no_vigente",
  "stock_insuficiente",
  "precio_cambiado",
  "carrito_vacio",
  "error_interno",
]);
export type CodigoError = z.infer<typeof codigoError>;

/** Forma única del error. `campos` solo aparece en `datos_invalidos`. */
export const error = z.object({
  codigo: codigoError,
  mensaje: z.string(),
  campos: z.record(z.string(), z.string()).optional(),
});
export type ErrorApi = z.infer<typeof error>;
