import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { drizzle } from "drizzle-orm/node-postgres";
import type pg from "pg";
import { adaptadorHttp } from "../src/adaptador.ts";
import { ModuloApp } from "../src/app.ts";
import { BASE_DE_DATOS } from "../src/db/base.ts";
import { montarDocumentacion } from "../src/documentacion.ts";
import { abrirRedis } from "./redis.ts";

// Levanta el servicio sobre la transacción de la prueba: lo que la prueba inserta lo ve
// el servicio, y todo se deshace al terminar.
export async function levantarApp(cliente: pg.Client): Promise<NestFastifyApplication> {
  const modulo = await Test.createTestingModule({ imports: [ModuloApp] })
    .overrideProvider(BASE_DE_DATOS)
    .useValue(drizzle(cliente))
    .compile();
  const app = modulo.createNestApplication<NestFastifyApplication>(adaptadorHttp());
  montarDocumentacion(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

// Deja el catálogo vacío dentro de la transacción, para que la prueba no dependa de los
// datos que ya tenga la base. También vacía el Redis de las pruebas: la caché y el stock
// visible que dejó una prueba no deben llegar a la siguiente.
export async function vaciarCatalogo(cliente: pg.Client): Promise<void> {
  const redis = abrirRedis();
  await redis.flushdb();
  await redis.quit();
  await cliente.query("delete from inventario.stock");
  await cliente.query("delete from inventario.productos");
  await cliente.query("delete from inventario.categorias");
}
