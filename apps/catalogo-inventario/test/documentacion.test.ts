import { readFile } from "node:fs/promises";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { levantarApp } from "./app.ts";
import { abrirTransaccion, deshacerTransaccion } from "./base.ts";

// Spec 001, T070 y T072. El servicio publica su documentación con Swagger, y la colección
// de Postman tiene una petición por cada endpoint.

const COLECCION = new URL(
  "../coleccion/catalogo-inventario.postman_collection.json",
  import.meta.url,
);

type Peticion = {
  name: string;
  request: { method: string; url: { raw: string; path: string[]; query?: { key: string }[] } };
};
type Carpeta = { name: string; item: (Peticion | Carpeta)[] };

function peticiones(elementos: (Peticion | Carpeta)[]): Peticion[] {
  return elementos.flatMap((elemento) =>
    "item" in elemento ? peticiones(elemento.item) : [elemento],
  );
}

describe("documentación del API", () => {
  let cliente: pg.Client;
  let app: NestFastifyApplication;
  let documento: {
    openapi: string;
    paths: Record<string, Record<string, { parameters?: { name: string; in: string }[] }>>;
  };

  beforeAll(async () => {
    cliente = await abrirTransaccion();
    app = await levantarApp(cliente);
    documento = (await request(app.getHttpServer()).get("/docs-json").expect(200)).body;
  });

  afterAll(async () => {
    await app.close();
    await deshacerTransaccion(cliente);
  });

  it("GET /docs muestra la página de Swagger", async () => {
    const respuesta = await request(app.getHttpServer()).get("/docs").expect(200);

    expect(respuesta.headers["content-type"]).toMatch(/text\/html/);
    expect(respuesta.text).toMatch(/swagger/i);
  });

  it("GET /docs-json describe los endpoints del catálogo en OpenAPI 3", () => {
    expect(documento.openapi).toMatch(/^3\./);
    expect(Object.keys(documento.paths)).toEqual(
      expect.arrayContaining([
        "/categorias",
        "/productos",
        "/productos/{id}",
        "/fotos/{archivo}",
        "/stock",
      ]),
    );
    expect(documento.paths["/productos"]!.get!.parameters!.map((p) => p.name).sort()).toEqual([
      "buscar",
      "categoria",
      "pagina",
    ]);
  });

  it("las respuestas salen de los esquemas del contrato", () => {
    const texto = JSON.stringify(documento.paths["/productos"]!.get);

    for (const campo of ["precio_centavos", "foto_url", "stock_visible", "hay_mas"]) {
      expect(texto).toContain(campo);
    }
    expect(texto).toContain("datos_invalidos");
  });

  it("la colección de Postman tiene una petición por cada endpoint, y ninguna de más", async () => {
    const coleccion = JSON.parse(await readFile(COLECCION, "utf8")) as Carpeta;
    const enLaColeccion = peticiones(coleccion.item).map(
      ({ request: { method, url } }) =>
        // `:id` en Postman es `{id}` en OpenAPI.
        `${method} /${url.path.map((parte) => parte.replace(/^:(.+)$/, "{$1}")).join("/")}`,
    );
    const enElServicio = Object.entries(documento.paths).flatMap(([ruta, metodos]) =>
      Object.keys(metodos).map((metodo) => `${metodo.toUpperCase()} ${ruta}`),
    );

    expect([...new Set(enLaColeccion)].sort()).toEqual(enElServicio.sort());
  });

  it("la colección usa cada parámetro de consulta en alguna petición", async () => {
    const coleccion = JSON.parse(await readFile(COLECCION, "utf8")) as Carpeta;
    const usados = new Set(
      peticiones(coleccion.item).flatMap(({ request: { url } }) =>
        (url.query ?? []).map((parametro) => `/${url.path.join("/")} ${parametro.key}`),
      ),
    );

    for (const [ruta, metodos] of Object.entries(documento.paths)) {
      for (const parametro of metodos.get?.parameters ?? []) {
        if (parametro.in === "query") {
          expect(usados, `${ruta} ${parametro.name}`).toContain(`${ruta} ${parametro.name}`);
        }
      }
    }
  });

  it("las peticiones de la colección usan la variable {{url}}", async () => {
    const coleccion = JSON.parse(await readFile(COLECCION, "utf8")) as Carpeta;

    for (const peticion of peticiones(coleccion.item)) {
      expect(peticion.request.url.raw, peticion.name).toMatch(/^\{\{url\}\}\//);
    }
  });
});

// Spec 001, T074. Swagger es una ayuda de desarrollo: en producción no se publica.
describe("documentación del API en producción", () => {
  let cliente: pg.Client;
  let app: NestFastifyApplication;
  const entorno = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = "production";
    cliente = await abrirTransaccion();
    app = await levantarApp(cliente);
  });

  afterAll(async () => {
    process.env.NODE_ENV = entorno;
    await app.close();
    await deshacerTransaccion(cliente);
  });

  it.each(["/docs", "/docs-json"])("GET %s responde 404", async (ruta) => {
    await request(app.getHttpServer()).get(ruta).expect(404);
  });

  it("el catálogo sigue respondiendo", async () => {
    await request(app.getHttpServer()).get("/categorias").expect(200);
  });
});
