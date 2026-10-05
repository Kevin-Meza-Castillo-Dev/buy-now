import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type pg from "pg";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { levantarApp } from "./app.ts";
import { abrirTransaccion, deshacerTransaccion } from "./base.ts";

// Spec 001, T025. El servicio entrega las fotos de los productos, con caché larga.

describe("GET /fotos/{archivo}.webp", () => {
  let cliente: pg.Client;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    cliente = await abrirTransaccion();
    app = await levantarApp(cliente);
  });

  afterAll(async () => {
    await app.close();
    await deshacerTransaccion(cliente);
  });

  it("entrega la imagen en WebP, con caché larga", async () => {
    const respuesta = await request(app.getHttpServer())
      .get("/fotos/limon.webp")
      .buffer(true)
      .parse((entrada, listo) => {
        const partes: Buffer[] = [];
        entrada.on("data", (parte: Buffer) => partes.push(parte));
        entrada.on("end", () => listo(null, Buffer.concat(partes)));
      })
      .expect(200);

    expect(respuesta.headers["content-type"]).toBe("image/webp");
    expect(respuesta.headers["cache-control"]).toBe("public, max-age=2592000");
    const imagen = await sharp(respuesta.body as Buffer).metadata();
    expect(imagen.format).toBe("webp");
    expect(imagen.width).toBe(480);
  });

  it.each([
    "/fotos/no-existe.webp",
    "/fotos/limon.png",
    "/fotos/limon",
    "/fotos/..%2Fpackage.json",
    "/fotos/..%2Fdatos%2Ffotos.webp",
    "/fotos/%2E%2E%2F%2E%2E%2Fpackage.webp",
  ])("GET %s responde 404", async (ruta) => {
    await request(app.getHttpServer()).get(ruta).expect(404);
  });
});
