import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Controller, Get, Header, NotFoundException, Param, StreamableFile } from "@nestjs/common";
import { SinLimiteDePeticiones } from "../limite-de-peticiones.ts";
import { ApiNotFoundResponse, ApiOperation, ApiParam, ApiProduces, ApiTags } from "@nestjs/swagger";

// La carpeta queda a la misma distancia de src/fotos/ que de dist/fotos/.
const CARPETA_DE_FOTOS = fileURLToPath(new URL("../../fotos", import.meta.url));

// Solo nombres como los de datos/fotos.json: así ninguna ruta sale de la carpeta.
const NOMBRE_DE_FOTO = /^[a-z0-9]+(-[a-z0-9]+)*\.webp$/;

const TREINTA_DIAS = 30 * 24 * 60 * 60;

// Las fotos de los productos. No exigen sesión ni cuentan para el límite de peticiones.
@ApiTags("Fotos")
@SinLimiteDePeticiones()
@Controller("fotos")
export class ControladorDeFotos {
  @Get(":archivo")
  @Header("Cache-Control", `public, max-age=${TREINTA_DIAS}`)
  @ApiOperation({
    summary: "La foto de un producto, en WebP de 480 × 480",
    description: "La ruta viene en `foto_url`. Se puede guardar en caché 30 días.",
  })
  @ApiParam({ name: "archivo", example: "limon.webp" })
  @ApiProduces("image/webp")
  @ApiNotFoundResponse({ description: "No hay una foto con ese nombre." })
  async foto(@Param("archivo") archivo: string): Promise<StreamableFile> {
    if (!NOMBRE_DE_FOTO.test(archivo)) {
      throw new NotFoundException();
    }
    try {
      const imagen = await readFile(join(CARPETA_DE_FOTOS, archivo));
      return new StreamableFile(imagen, { type: "image/webp", length: imagen.length });
    } catch {
      throw new NotFoundException();
    }
  }
}
