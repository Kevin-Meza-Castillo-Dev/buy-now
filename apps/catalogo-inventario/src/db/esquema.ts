import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgSchema,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const inventario = pgSchema("inventario");

export const categorias = inventario.table("categorias", {
  id: smallint("id").primaryKey(),
  nombre: text("nombre").notNull().unique(),
  orden: smallint("orden").notNull(),
});

export const productos = inventario.table(
  "productos",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // Llave con la que la carga de datos se repite sin duplicar, por ejemplo SUP-0001.
    codigo: text("codigo").notNull().unique(),
    nombre: text("nombre").notNull(),
    // El nombre en minúsculas y sin tildes. Lo calcula la aplicación al cargar.
    nombreBusqueda: text("nombre_busqueda").notNull(),
    descripcion: text("descripcion").notNull(),
    precioCentavos: integer("precio_centavos").notNull(),
    fotoRuta: text("foto_ruta").notNull(),
    categoriaId: smallint("categoria_id")
      .notNull()
      .references(() => categorias.id),
    activo: boolean("activo").notNull().default(true),
    creado: timestamp("creado", { withTimezone: true }).notNull().defaultNow(),
    actualizado: timestamp("actualizado", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [
    check("productos_precio_positivo", sql`${tabla.precioCentavos} > 0`),
    index("productos_categoria_nombre").on(tabla.categoriaId, tabla.nombre),
  ],
);

// El stock va en su propia tabla para que la reserva no bloquee filas de productos.
export const stock = inventario.table(
  "stock",
  {
    productoId: integer("producto_id")
      .primaryKey()
      .references(() => productos.id),
    disponible: integer("disponible").notNull(),
    // Sube en cada cambio y ordena los eventos de stock.
    version: bigint("version", { mode: "number" }).notNull().default(0),
    actualizado: timestamp("actualizado", { withTimezone: true }).notNull().defaultNow(),
  },
  // Última defensa de la regla "el stock nunca queda negativo".
  (tabla) => [check("stock_disponible_no_negativo", sql`${tabla.disponible} >= 0`)],
);
