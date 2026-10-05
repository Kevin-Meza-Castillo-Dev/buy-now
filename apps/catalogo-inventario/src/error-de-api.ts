import type { CodigoError, ErrorApi } from "@buy-now/contratos";
import { HttpException } from "@nestjs/common";
import type { ZodError } from "zod";

// Un error con la forma única del contrato: `codigo` estable y `mensaje` en español.
export class ErrorDeApi extends HttpException {
  constructor(estado: number, codigo: CodigoError, mensaje: string, campos?: ErrorApi["campos"]) {
    super({ codigo, mensaje, ...(campos ? { campos } : {}) } satisfies ErrorApi, estado);
  }
}

// 422 con el nombre de cada campo que no pasó la validación del contrato.
export function datosInvalidos(error: ZodError): ErrorDeApi {
  const campos: Record<string, string> = {};
  for (const problema of error.issues) {
    campos[String(problema.path[0] ?? "peticion")] = "El valor no es válido.";
  }
  return new ErrorDeApi(422, "datos_invalidos", "Revisa los campos marcados.", campos);
}
