import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { ModuloApp } from "./app.ts";
import { montarDocumentacion } from "./documentacion.ts";

const app = await NestFactory.create<NestFastifyApplication>(ModuloApp, new FastifyAdapter());
app.enableShutdownHooks();
montarDocumentacion(app);
// 0.0.0.0 para que el contenedor acepte conexiones de fuera.
await app.listen(Number(process.env.PUERTO ?? 3000), "0.0.0.0");
