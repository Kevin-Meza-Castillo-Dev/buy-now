import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { leerDatos, type DatosDePrueba, type ProductoDePrueba } from "./datos.ts";
import { SURTIDO } from "./surtido.ts";

// Dibuja la foto de cada producto de prueba (RF-012): una imagen WebP de 480 × 480 con el
// color de su categoría y su nombre. Las fotos no se guardan en el repositorio: se
// generan al construir la imagen Docker.

export const CARPETA_DE_FOTOS = fileURLToPath(new URL("../fotos", import.meta.url));

const LADO = 480;
const LETRAS_POR_LINEA = 16;
const A_LA_VEZ = 16;

function escapar(texto: string): string {
  return texto.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function partirEnLineas(nombre: string): string[] {
  const lineas: string[] = [];
  for (const palabra of nombre.split(" ")) {
    const ultima = lineas.at(-1);
    if (ultima !== undefined && `${ultima} ${palabra}`.length <= LETRAS_POR_LINEA) {
      lineas[lineas.length - 1] = `${ultima} ${palabra}`;
    } else {
      lineas.push(palabra);
    }
  }
  return lineas;
}

function dibujo(producto: ProductoDePrueba, color: string): string {
  const lineas = partirEnLineas(producto.nombre);
  const alto = 46;
  const primera = LADO / 2 - ((lineas.length - 1) * alto) / 2;
  const texto = lineas
    .map(
      (linea, indice) =>
        `<text x="240" y="${primera + indice * alto}" text-anchor="middle" dominant-baseline="middle">${escapar(linea)}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}">
    <rect width="${LADO}" height="${LADO}" fill="${color}"/>
    <circle cx="240" cy="240" r="210" fill="#FFFFFF" fill-opacity="0.12"/>
    <g fill="#FFFFFF" font-family="sans-serif" font-size="38" font-weight="700">${texto}</g>
  </svg>`;
}

export async function generarFotos(datos: DatosDePrueba, carpeta: string): Promise<void> {
  await mkdir(carpeta, { recursive: true });
  for (let desde = 0; desde < datos.productos.length; desde += A_LA_VEZ) {
    await Promise.all(
      datos.productos.slice(desde, desde + A_LA_VEZ).map((producto) => {
        const color = SURTIDO[producto.categoria_id - 1]!.color;
        return sharp(Buffer.from(dibujo(producto, color)))
          .webp({ quality: 80 })
          .toFile(join(carpeta, producto.foto_ruta));
      }),
    );
  }
}

if (import.meta.main) {
  const datos = await leerDatos();
  await generarFotos(datos, CARPETA_DE_FOTOS);
  console.log(`${datos.productos.length} fotos escritas en ${CARPETA_DE_FOTOS}`);
}
