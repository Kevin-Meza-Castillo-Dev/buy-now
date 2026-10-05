import { Module } from "@nestjs/common";
import { ModuloBaseDeDatos } from "../db/base.ts";
import { ModuloRedis } from "../redis.ts";
import { ModuloStockVisible } from "../stock-visible/modulo.ts";
import { CacheDelCatalogo } from "./cache.ts";
import { ConsultasDelCatalogo } from "./consultas.ts";
import { ControladorDelCatalogo } from "./controlador.ts";

@Module({
  imports: [ModuloBaseDeDatos, ModuloRedis, ModuloStockVisible],
  controllers: [ControladorDelCatalogo],
  providers: [CacheDelCatalogo, ConsultasDelCatalogo],
})
export class ModuloCatalogo {}
