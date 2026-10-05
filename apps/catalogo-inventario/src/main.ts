import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { ModuloApp } from "./app.ts";

const app = await NestFactory.create<NestFastifyApplication>(ModuloApp, new FastifyAdapter());
app.enableShutdownHooks();
// 0.0.0.0 para que el contenedor acepte conexiones de fuera.
await app.listen(Number(process.env.PUERTO ?? 3000), "0.0.0.0");
