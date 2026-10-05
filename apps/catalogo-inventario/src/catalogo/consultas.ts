import type { Categoria } from "@buy-now/contratos";
import { Inject, Injectable } from "@nestjs/common";
import { asc } from "drizzle-orm";
import { BASE_DE_DATOS, type BaseDeDatos } from "../db/base.ts";
import { categorias } from "../db/esquema.ts";

// Las lecturas del catálogo en Postgres.
@Injectable()
export class ConsultasDelCatalogo {
  constructor(@Inject(BASE_DE_DATOS) private readonly base: BaseDeDatos) {}

  // Todas las categorías, en su orden de aparición (RF-004).
  async categorias(): Promise<Categoria[]> {
    return this.base
      .select({ id: categorias.id, nombre: categorias.nombre })
      .from(categorias)
      .orderBy(asc(categorias.orden));
  }
}
