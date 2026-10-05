import {
  TAMANO_PAGINA,
  type Categoria,
  type ConsultaProductos,
  type ProductoDetalle,
  type RespuestaProductos,
} from "@buy-now/contratos";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, like, sql } from "drizzle-orm";
import { BASE_DE_DATOS, type BaseDeDatos } from "../db/base.ts";
import { categorias, productos } from "../db/esquema.ts";
import { StockVisible } from "../stock-visible/stock-visible.ts";
import { normalizarNombre } from "./normalizar-nombre.ts";

// Los ids de categoría son smallint y los de producto, integer. Un número mayor no puede
// ser de ninguna fila, y Postgres lo rechazaría al compararlo.
const MAYOR_ID_DE_CATEGORIA = 32_767;
const MAYOR_ID_DE_PRODUCTO = 2_147_483_647;

// Las lecturas del catálogo en Postgres.
@Injectable()
export class ConsultasDelCatalogo {
  constructor(
    @Inject(BASE_DE_DATOS) private readonly base: BaseDeDatos,
    @Inject(StockVisible) private readonly stockVisible: StockVisible,
  ) {}

  // Todas las categorías, en su orden de aparición (RF-004).
  async categorias(): Promise<Categoria[]> {
    return this.base
      .select({ id: categorias.id, nombre: categorias.nombre })
      .from(categorias)
      .orderBy(asc(categorias.orden));
  }

  // Una página de productos activos, por el orden de su categoría y después por nombre
  // (RF-001, RF-005). `buscar` reduce la lista a los que tienen ese texto en el nombre (RF-003)
  // y `categoria`, a los de esa categoría (RF-004).
  async productos(consulta: ConsultaProductos): Promise<RespuestaProductos> {
    // El texto se normaliza igual que el nombre guardado. Las barras escapan % y _, para
    // que se busquen como texto y no como comodines de LIKE.
    const texto = normalizarNombre(consulta.buscar ?? "").replace(/[\\%_]/g, "\\$&");
    if (consulta.categoria !== undefined && consulta.categoria > MAYOR_ID_DE_CATEGORIA) {
      return { productos: [], pagina: consulta.pagina, hay_mas: false };
    }
    const filas = await this.base
      .select({
        id: productos.id,
        nombre: productos.nombre,
        precio_centavos: productos.precioCentavos,
        foto_ruta: productos.fotoRuta,
        categoria_id: productos.categoriaId,
      })
      .from(productos)
      .innerJoin(categorias, eq(categorias.id, productos.categoriaId))
      .where(
        and(
          eq(productos.activo, true),
          texto === "" ? undefined : like(productos.nombreBusqueda, `%${texto}%`),
          consulta.categoria === undefined
            ? undefined
            : eq(productos.categoriaId, consulta.categoria),
        ),
      )
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

    const pagina = filas.slice(0, TAMANO_PAGINA);
    const disponibles = await this.stockVisible.de(pagina.map((producto) => producto.id));
    return {
      productos: pagina.map(({ foto_ruta, ...producto }) => ({
        ...producto,
        foto_url: `/fotos/${foto_ruta}`,
        stock_visible: disponibles.get(producto.id) ?? 0,
      })),
      pagina: consulta.pagina,
      hay_mas: filas.length > TAMANO_PAGINA,
    };
  }

  // Un producto activo con su descripción y su categoría (RF-002). Sin valor si no existe
  // o no está activo.
  async producto(id: number): Promise<ProductoDetalle | undefined> {
    if (id > MAYOR_ID_DE_PRODUCTO) {
      return undefined;
    }
    const [fila] = await this.base
      .select({
        id: productos.id,
        nombre: productos.nombre,
        precio_centavos: productos.precioCentavos,
        foto_ruta: productos.fotoRuta,
        categoria_id: productos.categoriaId,
        descripcion: productos.descripcion,
        categoria: { id: categorias.id, nombre: categorias.nombre },
      })
      .from(productos)
      .innerJoin(categorias, eq(categorias.id, productos.categoriaId))
      .where(and(eq(productos.id, id), eq(productos.activo, true)));
    if (!fila) {
      return undefined;
    }
    const { foto_ruta, ...producto } = fila;
    const disponibles = await this.stockVisible.de([id]);
    return {
      ...producto,
      foto_url: `/fotos/${foto_ruta}`,
      stock_visible: disponibles.get(id) ?? 0,
    };
  }
}
