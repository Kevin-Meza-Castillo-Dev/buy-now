import { consultaProductos, type Categoria, type RespuestaProductos } from "@buy-now/contratos";
import { Controller, Get, Inject, Query } from "@nestjs/common";
import { datosInvalidos } from "../error-de-api.ts";
import { ConsultasDelCatalogo } from "./consultas.ts";

// Endpoints del catálogo. Ninguno exige sesión.
@Controller()
export class ControladorDelCatalogo {
  constructor(@Inject(ConsultasDelCatalogo) private readonly consultas: ConsultasDelCatalogo) {}

  @Get("categorias")
  async categorias(): Promise<{ categorias: Categoria[] }> {
    return { categorias: await this.consultas.categorias() };
  }

  @Get("productos")
  async productos(@Query() parametros: unknown): Promise<RespuestaProductos> {
    const consulta = consultaProductos.safeParse(parametros);
    if (!consulta.success) {
      throw datosInvalidos(consulta.error);
    }
    return this.consultas.productos(consulta.data);
  }
}
