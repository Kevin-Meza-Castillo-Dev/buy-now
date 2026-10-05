import {
  TAMANO_PAGINA,
  type Categoria,
  type ConsultaProductos,
  type RespuestaProductos,
} from "@buy-now/contratos";
import { Inject, Injectable } from "@nestjs/common";
import { asc, eq, sql } from "drizzle-orm";
import { BASE_DE_DATOS, type BaseDeDatos } from "../db/base.ts";
import { categorias, productos, stock } from "../db/esquema.ts";

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

  // Una página de productos activos, por el orden de su categoría y después por nombre
  // (RF-001, RF-005).
  async productos(consulta: ConsultaProductos): Promise<RespuestaProductos> {
    const filas = await this.base
      .select({
        id: productos.id,
        nombre: productos.nombre,
        precio_centavos: productos.precioCentavos,
        foto_ruta: productos.fotoRuta,
        categoria_id: productos.categoriaId,
        stock_visible: sql<number>`coalesce(${stock.disponible}, 0)`,
      })
      .from(productos)
      .innerJoin(categorias, eq(categorias.id, productos.categoriaId))
      .leftJoin(stock, eq(stock.productoId, productos.id))
      .where(eq(productos.activo, true))
      // El nombre sin tildes y con la intercalación "C" ordena igual en cualquier
      // Postgres. El id desempata, para que las páginas no repitan ni salten productos.
      .orderBy(
        asc(categorias.orden),
        sql`${productos.nombreBusqueda} collate "C"`,
        asc(productos.id),
      )
      // Se pide uno de más para saber si hay otra página.
      .limit(TAMANO_PAGINA + 1)
      .offset((consulta.pagina - 1) * TAMANO_PAGINA);

    return {
      productos: filas.slice(0, TAMANO_PAGINA).map(({ foto_ruta, ...producto }) => ({
        ...producto,
        foto_url: `/fotos/${foto_ruta}`,
      })),
      pagina: consulta.pagina,
      hay_mas: filas.length > TAMANO_PAGINA,
    };
  }
}
