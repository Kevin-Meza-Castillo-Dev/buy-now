import { Module } from "@nestjs/common";
import { ModuloBaseDeDatos } from "../db/base.ts";
import { ModuloRedis } from "../redis.ts";
import { ControladorDeStock } from "./controlador.ts";
import { StockVisible } from "./stock-visible.ts";

@Module({
  imports: [ModuloBaseDeDatos, ModuloRedis],
  controllers: [ControladorDeStock],
  providers: [StockVisible],
  exports: [StockVisible],
})
export class ModuloStockVisible {}
