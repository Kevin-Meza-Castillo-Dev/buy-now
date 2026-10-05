import { Module } from "@nestjs/common";
import { ModuloCatalogo } from "./catalogo/modulo.ts";
import { ModuloFotos } from "./fotos/modulo.ts";
import { ModuloLimiteDePeticiones } from "./limite-de-peticiones.ts";
import { ModuloStockVisible } from "./stock-visible/modulo.ts";

@Module({ imports: [ModuloCatalogo, ModuloFotos, ModuloLimiteDePeticiones, ModuloStockVisible] })
export class ModuloApp {}
