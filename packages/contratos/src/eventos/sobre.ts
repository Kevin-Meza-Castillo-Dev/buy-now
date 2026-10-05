import { z } from "zod";
import { fecha } from "../comun.ts";

/** Sobre común de todos los eventos: `{ id, tipo, ocurrido_en, datos }`. */
export const sobre = <Tipo extends string, Datos extends z.ZodType>(tipo: Tipo, datos: Datos) =>
  z.object({
    id: z.uuid(),
    tipo: z.literal(tipo),
    ocurrido_en: fecha,
    datos,
  });
