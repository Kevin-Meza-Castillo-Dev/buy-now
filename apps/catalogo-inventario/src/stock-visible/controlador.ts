import { consultaStock, error, respuestaStock, type RespuestaStock } from "@buy-now/contratos";
import { Controller, Get, Header, Inject, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { esquemaDe } from "../documentacion.ts";
import { datosInvalidos } from "../error-de-api.ts";
import { StockVisible } from "./stock-visible.ts";

// El stock visible de los productos en pantalla. No exige sesión.
@ApiTags("Stock")
@Controller("stock")
export class ControladorDeStock {
  constructor(@Inject(StockVisible) private readonly stockVisible: StockVisible) {}

  @Get()
  // La app pide los ids de cada página completos y en orden, así muchos clientes piden
  // la misma URL y la caché la responde.
  @Header("Cache-Control", "public, max-age=5")
  @ApiOperation({
    summary: "Las unidades disponibles de hasta 50 productos",
    description:
      "Para refrescar el stock de los productos en pantalla. La respuesta se puede guardar " +
      "en caché 5 segundos. Un id que no es de ningún producto no aparece en la respuesta.",
  })
  @ApiQuery({
    name: "ids",
    description: "De 1 a 50 ids de producto, separados por coma.",
    schema: { type: "string", pattern: "^\\d+(,\\d+){0,49}$" },
    example: "1,2,3",
  })
  @ApiOkResponse({ schema: esquemaDe(respuestaStock) })
  @ApiResponse({
    status: 422,
    description: "`datos_invalidos`: faltan los ids, alguno no es un id o son más de 50.",
    schema: esquemaDe(error),
  })
  async stock(@Query() parametros: unknown): Promise<RespuestaStock> {
    const consulta = consultaStock.safeParse(parametros);
    if (!consulta.success) {
      throw datosInvalidos(consulta.error);
    }
    const ids = [...new Set(consulta.data.ids)];
    const disponibles = await this.stockVisible.de(ids);
    return {
      stock: ids
        .filter((id) => disponibles.has(id))
        .map((id) => ({ producto_id: id, disponible: disponibles.get(id)! })),
    };
  }
}
