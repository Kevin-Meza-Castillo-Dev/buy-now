import {
  consultaProductos,
  error,
  productoDetalle,
  productoId,
  respuestaCategorias,
  respuestaProductos,
  type Categoria,
  type ProductoDetalle,
  type RespuestaProductos,
} from "@buy-now/contratos";
import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { esquemaDe } from "../documentacion.ts";
import { datosInvalidos, ErrorDeApi } from "../error-de-api.ts";
import { ConsultasDelCatalogo } from "./consultas.ts";

// Endpoints del catálogo. Ninguno exige sesión.
@ApiTags("Catálogo")
@Controller()
export class ControladorDelCatalogo {
  constructor(@Inject(ConsultasDelCatalogo) private readonly consultas: ConsultasDelCatalogo) {}

  @Get("categorias")
  @ApiOperation({ summary: "Todas las categorías, en su orden de aparición" })
  @ApiOkResponse({ schema: esquemaDe(respuestaCategorias) })
  async categorias(): Promise<{ categorias: Categoria[] }> {
    return { categorias: await this.consultas.categorias() };
  }

  @Get("productos")
  @ApiOperation({
    summary: "Una página de 20 productos activos",
    description:
      "Ordenados por el orden de su categoría y, dentro de ella, por nombre. " +
      "`buscar` y `categoria` reducen la lista, y se pueden combinar.",
  })
  @ApiQuery({
    name: "buscar",
    required: false,
    description: "Texto que debe estar en el nombre. No distingue mayúsculas ni tildes.",
    schema: { type: "string", maxLength: 60 },
  })
  @ApiQuery({
    name: "categoria",
    required: false,
    description: "Id de la categoría, de `GET /categorias`.",
    schema: { type: "integer", minimum: 1 },
  })
  @ApiQuery({
    name: "pagina",
    required: false,
    description: "Número de página, desde 1.",
    schema: { type: "integer", minimum: 1, default: 1 },
  })
  @ApiOkResponse({ schema: esquemaDe(respuestaProductos) })
  @ApiResponse({
    status: 422,
    description: "`datos_invalidos`: un parámetro no pasó la validación.",
    schema: esquemaDe(error),
  })
  async productos(@Query() parametros: unknown): Promise<RespuestaProductos> {
    const consulta = consultaProductos.safeParse(parametros);
    if (!consulta.success) {
      throw datosInvalidos(consulta.error);
    }
    return this.consultas.productos(consulta.data);
  }

  @Get("productos/:id")
  @ApiOperation({ summary: "Un producto activo, con su descripción y su categoría" })
  @ApiParam({ name: "id", schema: { type: "integer", minimum: 1 } })
  @ApiOkResponse({ schema: esquemaDe(productoDetalle) })
  @ApiNotFoundResponse({
    description: "`producto_no_encontrado`: el producto no existe o no está activo.",
    schema: esquemaDe(error),
  })
  async producto(@Param("id") texto: string): Promise<ProductoDetalle> {
    // Un id que no es un entero positivo no es de ningún producto: mismo 404.
    const id = /^\d+$/.test(texto) ? productoId.safeParse(Number(texto)) : undefined;
    const producto = id?.success ? await this.consultas.producto(id.data) : undefined;
    if (!producto) {
      throw new ErrorDeApi(404, "producto_no_encontrado", "Este producto ya no está disponible.");
    }
    return producto;
  }
}
