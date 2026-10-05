import { Module } from "@nestjs/common";
import { ModuloCatalogo } from "./catalogo/modulo.ts";

@Module({ imports: [ModuloCatalogo] })
export class ModuloApp {}
