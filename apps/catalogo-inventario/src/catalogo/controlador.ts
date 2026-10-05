import type { Categoria } from "@buy-now/contratos";
import { Controller, Get, Inject } from "@nestjs/common";
import { ConsultasDelCatalogo } from "./consultas.ts";

// Endpoints del catálogo. Ninguno exige sesión.
@Controller()
export class ControladorDelCatalogo {
  constructor(@Inject(ConsultasDelCatalogo) private readonly consultas: ConsultasDelCatalogo) {}

  @Get("categorias")
  async categorias(): Promise<{ categorias: Categoria[] }> {
    return { categorias: await this.consultas.categorias() };
  }
}
