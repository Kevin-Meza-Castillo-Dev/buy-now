import { Module } from "@nestjs/common";
import { ModuloCatalogo } from "./catalogo/modulo.ts";
import { ModuloFotos } from "./fotos/modulo.ts";

@Module({ imports: [ModuloCatalogo, ModuloFotos] })
export class ModuloApp {}
