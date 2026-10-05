import { Module } from "@nestjs/common";
import { ModuloBaseDeDatos } from "../db/base.ts";
import { ConsultasDelCatalogo } from "./consultas.ts";
import { ControladorDelCatalogo } from "./controlador.ts";

@Module({
  imports: [ModuloBaseDeDatos],
  controllers: [ControladorDelCatalogo],
  providers: [ConsultasDelCatalogo],
})
export class ModuloCatalogo {}
