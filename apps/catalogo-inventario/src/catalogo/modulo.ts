import { Module } from "@nestjs/common";
import { ModuloBaseDeDatos } from "../db/base.ts";
import { ModuloStockVisible } from "../stock-visible/modulo.ts";
import { ConsultasDelCatalogo } from "./consultas.ts";
import { ControladorDelCatalogo } from "./controlador.ts";

@Module({
  imports: [ModuloBaseDeDatos, ModuloStockVisible],
  controllers: [ControladorDelCatalogo],
  providers: [ConsultasDelCatalogo],
})
export class ModuloCatalogo {}
