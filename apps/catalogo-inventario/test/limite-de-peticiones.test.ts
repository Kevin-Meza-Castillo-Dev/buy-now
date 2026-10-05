import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Redis } from "ioredis";
import type pg from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { levantarApp, vaciarCatalogo } from "./app.ts";
import { abrirTransaccion, deshacerTransaccion } from "./base.ts";
import { insertarCategoria, insertarProducto } from "./catalogo-de-prueba.ts";
import { abrirRedis, conRedisCaido } from "./redis.ts";

// Spec 001, T033. Cada IP tiene un límite de peticiones por minuto, contado en Redis. Al
// pasarlo, el servicio responde 429 `demasiadas_peticiones`. El límite se cambia o se
// desactiva por variable de entorno, para la prueba de carga, que sale de una sola IP.

// Levanta lo que haga `levantar` con esas variables de entorno, y las devuelve a como estaban.
async function conEntorno<T>(
  variables: Record<string, string>,
  levantar: () => Promise<T>,
): Promise<T> {
  const antes = Object.keys(variables).map((nombre) => [nombre, process.env[nombre]] as const);
  Object.assign(process.env, variables);
  try {
    return await levantar();
  } finally {
    for (const [nombre, valor] of antes) {
      if (valor === undefined) {
        delete process.env[nombre];
      } else {
        process.env[nombre] = valor;
      }
    }
  }
}

// La cuenta es por minuto de reloj. Si el minuto está por cambiar, se espera al siguiente,
// para que las peticiones de una prueba caigan todas en el mismo.
async function esperarSiElMinutoEstaPorCambiar(): Promise<void> {
  const restan = 60_000 - (Date.now() % 60_000);
  if (restan < 3000) {
    await new Promise((listo) => setTimeout(listo, restan + 50));
  }
}

describe("límite de peticiones", () => {
  let cliente: pg.Client;
  let redis: Redis;
  let app: NestFastifyApplication | undefined;
  let productoId: number;

  async function levantarConLimite(
    limite: string,
    otras: Record<string, string> = {},
  ): Promise<NestFastifyApplication> {
    app = await conEntorno({ LIMITE_DE_PETICIONES_POR_MINUTO: limite, ...otras }, () =>
      levantarApp(cliente),
    );
    return app;
  }

  beforeEach(async () => {
    cliente = await abrirTransaccion();
    redis = abrirRedis();
    await vaciarCatalogo(cliente);
    await insertarCategoria(cliente, { id: 1, nombre: "Frutas y verduras", orden: 1 });
    productoId = await insertarProducto(cliente, { nombre: "Mango", categoria_id: 1 });
    await esperarSiElMinutoEstaPorCambiar();
  }, 10_000);

  afterEach(async () => {
    await app?.close();
    app = undefined;
    await redis.flushdb();
    await redis.quit();
    await deshacerTransaccion(cliente);
  });

  it("responde 429 demasiadas_peticiones al pasar el límite", async () => {
    const servidor = (await levantarConLimite("3")).getHttpServer();

    for (let numero = 0; numero < 3; numero++) {
      await request(servidor).get("/categorias").expect(200);
    }
    const respuesta = await request(servidor).get("/categorias").expect(429);

    expect(respuesta.body).toEqual({
      codigo: "demasiadas_peticiones",
      mensaje: expect.any(String),
    });
  });

  it("cuenta juntas las peticiones a todos los endpoints del API", async () => {
    const servidor = (await levantarConLimite("3")).getHttpServer();

    await request(servidor).get("/categorias").expect(200);
    await request(servidor).get("/productos").expect(200);
    await request(servidor).get(`/productos/${productoId}`).expect(200);

    await request(servidor).get(`/stock?ids=${productoId}`).expect(429);
    await request(servidor).get("/productos").expect(429);
  });

  it("las fotos no cuentan ni se limitan", async () => {
    const servidor = (await levantarConLimite("2")).getHttpServer();

    for (let numero = 0; numero < 5; numero++) {
      await request(servidor).get("/fotos/limon.webp").expect(200);
    }
    await request(servidor).get("/categorias").expect(200);
    await request(servidor).get("/categorias").expect(200);
    await request(servidor).get("/categorias").expect(429);
    await request(servidor).get("/fotos/limon.webp").expect(200);
  });

  it("con el límite en 0 no limita", async () => {
    const servidor = (await levantarConLimite("0")).getHttpServer();

    for (let numero = 0; numero < 10; numero++) {
      await request(servidor).get("/categorias").expect(200);
    }
    expect(await redis.keys("limite:*")).toEqual([]);
  });

  it("sin la variable, el límite es de 300 por minuto", async () => {
    app = await levantarApp(cliente);
    await request(app.getHttpServer()).get("/categorias").expect(200);

    // Se adelanta la cuenta hasta la petición 299, en vez de hacerlas todas.
    const [clave] = await redis.keys("limite:*");
    await redis.set(clave!, 299, "EX", 60);

    await request(app.getHttpServer()).get("/categorias").expect(200);
    await request(app.getHttpServer()).get("/categorias").expect(429);
  });

  it("la cuenta vence sola en un minuto", async () => {
    const servidor = (await levantarConLimite("3")).getHttpServer();

    await request(servidor).get("/categorias").expect(200);

    const claves = await redis.keys("limite:*");
    expect(claves).toHaveLength(1);
    const vigencia = await redis.ttl(claves[0]!);
    expect(vigencia).toBeGreaterThan(0);
    expect(vigencia).toBeLessThanOrEqual(60);
  });

  it("detrás de un proxy, cuenta por la IP del cliente y no por la del proxy", async () => {
    const servidor = (await levantarConLimite("2", { SALTOS_DE_PROXY: "1" })).getHttpServer();
    const desde = (ip: string) => request(servidor).get("/categorias").set("X-Forwarded-For", ip);

    await desde("203.0.113.7").expect(200);
    await desde("203.0.113.7").expect(200);
    await desde("203.0.113.7").expect(429);

    await desde("203.0.113.8").expect(200);
  });

  it("sin proxy declarado, no se fía de X-Forwarded-For", async () => {
    const servidor = (await levantarConLimite("2")).getHttpServer();
    const desde = (ip: string) => request(servidor).get("/categorias").set("X-Forwarded-For", ip);

    await desde("203.0.113.7").expect(200);
    await desde("203.0.113.8").expect(200);

    await desde("203.0.113.9").expect(429);
  });

  it("con Redis caído no limita", async () => {
    app = await conRedisCaido(() => levantarConLimite("1"));

    for (let numero = 0; numero < 3; numero++) {
      await request(app.getHttpServer()).get("/categorias").expect(200);
    }
  });

  it("un límite que no es un número entero impide arrancar", async () => {
    await expect(levantarConLimite("muchas")).rejects.toThrow(/LIMITE_DE_PETICIONES_POR_MINUTO/);
  });

  it("Swagger documenta el 429 en el API y no en las fotos", async () => {
    const servidor = (await levantarConLimite("300")).getHttpServer();
    const documento = (await request(servidor).get("/docs-json").expect(200)).body as {
      paths: Record<string, { get: { responses: Record<string, unknown> } }>;
    };

    for (const ruta of ["/categorias", "/productos", "/productos/{id}", "/stock"]) {
      expect(JSON.stringify(documento.paths[ruta]!.get.responses["429"]), ruta).toContain(
        "demasiadas_peticiones",
      );
    }
    expect(documento.paths["/fotos/{archivo}"]!.get.responses["429"]).toBeUndefined();
  });
});
