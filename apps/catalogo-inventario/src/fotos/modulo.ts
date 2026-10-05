import { Module } from "@nestjs/common";
import { ControladorDeFotos } from "./controlador.ts";

@Module({ controllers: [ControladorDeFotos] })
export class ModuloFotos {}
