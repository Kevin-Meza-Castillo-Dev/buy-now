import {
  TAMANO_PAGINA,
  type Categoria,
  type ConsultaProductos,
  type ProductoDetalle,
  type ProductoResumen,
  type RespuestaProductos,
} from "@buy-now/contratos";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, like, sql } from "drizzle-orm";
import { BASE_DE_DATOS, type BaseDeDatos } from "../db/base.ts";
import { categorias, productos } from "../db/esquema.ts";
import { StockVisible } from "../stock-visible/stock-visible.ts";
import { CacheDelCatalogo } from "./cache.ts";
import { normalizarNombre } from "./normalizar-nombre.ts";

// Los ids de categoría son smallint y los de producto, integer. Un número mayor no puede
// ser de ninguna fila, y Postgres lo rechazaría al compararlo.
const MAYOR_ID_DE_CATEGORIA = 32_767;
const MAYOR_ID_DE_PRODUCTO = 2_147_483_647;

// Lo que se guarda en la caché no lleva el stock: se añade en cada respuesta.
type SinStock<T> = Omit<T, "stock_visible">;
type PaginaSinStock = { productos: SinStock<ProductoResumen>[]; hay_mas: boolean };

// Las lecturas del catálogo: los datos de Postgres, con caché de 60 segundos, y el stock
// visible aparte.
@Injectable()
export class ConsultasDelCatalogo {
  constructor(
    @Inject(BASE_DE_DATOS) private readonly base: BaseDeDatos,
    @Inject(StockVisible) private readonly stockVisible: StockVisible,
    @Inject(CacheDelCatalogo) private readonly cache: CacheDelCatalogo,
  ) {}

  // Todas las categorías, en su orden de aparición (RF-004).
  async categorias(): Promise<Categoria[]> {
    return this.cache.leer("categorias", () =>
      this.base
        .select({ id: categorias.id, nombre: categorias.nombre })
        .from(categorias)
        .orderBy(asc(categorias.orden)),
    );
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

    // Las búsquedas con texto no se guardan: hay demasiadas distintas. Una página vacía
    // tampoco, para que pedir páginas que no existen no llene Redis.
    const pagina =
      texto === ""
        ? await this.cache.leer(
            `lista:${consulta.categoria ?? "todas"}:${consulta.pagina}`,
            () => this.paginaDeProductos(consulta, texto),
            (leida) => leida.productos.length > 0,
          )
        : await this.paginaDeProductos(consulta, texto);

    const disponibles = await this.stockVisible.de(pagina.productos.map((producto) => producto.id));
    return {
      productos: pagina.productos.map((producto) => ({
        ...producto,
        stock_visible: disponibles.get(producto.id) ?? 0,
      })),
      pagina: consulta.pagina,
      hay_mas: pagina.hay_mas,
    };
  }

  // Un producto activo con su descripción y su categoría (RF-002). Sin valor si no existe
  // o no está activo.
  async producto(id: number): Promise<ProductoDetalle | undefined> {
    if (id > MAYOR_ID_DE_PRODUCTO) {
      return undefined;
    }
    const producto = await this.cache.leer(
      `producto:${id}`,
      () => this.detalleDeProducto(id),
      (leido) => leido !== undefined,
    );
    if (!producto) {
      return undefined;
    }
    const disponibles = await this.stockVisible.de([id]);
    return { ...producto, stock_visible: disponibles.get(id) ?? 0 };
  }

  private async paginaDeProductos(
    consulta: ConsultaProductos,
    texto: string,
  ): Promise<PaginaSinStock> {
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

    return {
      productos: filas.slice(0, TAMANO_PAGINA).map(({ foto_ruta, ...producto }) => ({
        ...producto,
        foto_url: `/fotos/${foto_ruta}`,
      })),
      hay_mas: filas.length > TAMANO_PAGINA,
    };
  }

  private async detalleDeProducto(id: number): Promise<SinStock<ProductoDetalle> | undefined> {
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
    return { ...producto, foto_url: `/fotos/${foto_ruta}` };
  }
}
