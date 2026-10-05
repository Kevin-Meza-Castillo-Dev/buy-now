import { migrar } from "../src/db/migrar.ts";
import { urlDeLaBase } from "./base.ts";

// Deja el esquema al día antes de las pruebas de integración.
export default async function preparar(): Promise<void> {
  await migrar(urlDeLaBase());
}
