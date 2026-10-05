import pg from "pg";
import { normalizarNombre } from "../src/catalogo/normalizar-nombre.ts";
import { leerDatos, type DatosDePrueba } from "./datos.ts";

// Carga el conjunto fijo de datos de prueba (RF-012). Se puede repetir: categorías y
// productos se insertan o actualizan por su llave, y el stock solo se inserta si el
// producto no lo tiene, para no pisar el stock vivo. Con `reiniciarStock` vuelve al
// valor inicial, para la prueba de carga.
//
// No abre ni cierra la transacción: quien llama decide, para que la carga sea todo o nada.
export async function cargarDatos(
  cliente: pg.ClientBase,
  datos: DatosDePrueba,
  opciones: { reiniciarStock?: boolean } = {},
): Promise<void> {
  await cliente.query(
    `insert into inventario.categorias (id, nombre, orden)
     select id, nombre, orden
       from jsonb_to_recordset($1::jsonb) as c (id smallint, nombre text, orden smallint)
     on conflict (id) do update set nombre = excluded.nombre, orden = excluded.orden`,
    [JSON.stringify(datos.categorias)],
  );

  const productos = datos.productos.map((producto) => ({
    ...producto,
    nombre_busqueda: normalizarNombre(producto.nombre),
  }));
  const filas = JSON.stringify(productos);

  await cliente.query(
    `insert into inventario.productos
       (codigo, nombre, nombre_busqueda, descripcion, precio_centavos, foto_ruta, categoria_id, activo)
     select codigo, nombre, nombre_busqueda, descripcion, precio_centavos, foto_ruta, categoria_id, activo
       from jsonb_to_recordset($1::jsonb) as p (
         codigo text, nombre text, nombre_busqueda text, descripcion text,
         precio_centavos integer, foto_ruta text, categoria_id smallint, activo boolean
       )
     on conflict (codigo) do update set
       nombre = excluded.nombre,
       nombre_busqueda = excluded.nombre_busqueda,
       descripcion = excluded.descripcion,
       precio_centavos = excluded.precio_centavos,
       foto_ruta = excluded.foto_ruta,
       categoria_id = excluded.categoria_id,
       activo = excluded.activo,
       actualizado = now()`,
    [filas],
  );

  const siYaTieneStock = opciones.reiniciarStock
    ? `do update set
         disponible = excluded.disponible,
         version = inventario.stock.version + 1,
         actualizado = now()`
    : "do nothing";

  await cliente.query(
    `insert into inventario.stock (producto_id, disponible)
     select p.id, d.stock_inicial
       from jsonb_to_recordset($1::jsonb) as d (codigo text, stock_inicial integer)
       join inventario.productos p on p.codigo = d.codigo
     on conflict (producto_id) ${siYaTieneStock}`,
    [filas],
  );
}

if (import.meta.main) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Falta DATABASE_URL.");
  }
  const reiniciarStock = process.argv.includes("--reiniciar-stock");
  const datos = await leerDatos();
  const cliente = new pg.Client({ connectionString: databaseUrl });
  await cliente.connect();
  try {
    await cliente.query("begin");
    await cargarDatos(cliente, datos, { reiniciarStock });
    await cliente.query("commit");
  } catch (error) {
    await cliente.query("rollback");
    throw error;
  } finally {
    await cliente.end();
  }
  console.log(
    `${datos.productos.length} productos cargados${reiniciarStock ? ", con el stock reiniciado" : ""}.`,
  );
}
