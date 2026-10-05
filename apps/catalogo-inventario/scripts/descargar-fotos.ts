import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import {
  ARCHIVO_DE_FOTOS,
  CARPETA_DE_FOTOS,
  leerFotos,
  LICENCIA_LIBRE,
  type FotoDePrueba,
} from "./fotos.ts";

// Baja de Wikimedia Commons las fotos elegidas en datos/fotos.json (RF-012), las recorta
// a WebP de 480 × 480 en fotos/ y anota el autor, la licencia y la fuente de cada una.
// Se corre a mano cuando cambia la lista; las fotos se guardan en el repositorio.
//
//   pnpm fotos:descargar                 baja las que faltan en fotos/
//   pnpm fotos:descargar limon.webp      baja esas, aunque ya existan
//   pnpm fotos:descargar --todas         las baja todas de nuevo

const LADO = 480;
const API = "https://commons.wikimedia.org/w/api.php";
// Wikimedia pide que cada cliente se identifique.
const AGENTE = "buy-now/0.1 (https://github.com/Kevin-Meza-Castillo-Dev/buy-now)";

export async function recortarFoto(original: Buffer): Promise<Buffer> {
  return sharp(original)
    .rotate()
    .resize(LADO, LADO, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 80 })
    .toBuffer();
}

type RespuestaDeCommons = {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: {
          thumburl: string;
          descriptionurl: string;
          extmetadata?: Record<string, { value: string } | undefined>;
        }[];
      }
    >;
  };
};

async function pedir(url: string): Promise<Response> {
  for (let intento = 1; ; intento++) {
    const respuesta = await fetch(url, { headers: { "User-Agent": AGENTE } });
    if (respuesta.ok) return respuesta;
    if (intento === 5) throw new Error(`${respuesta.status} al pedir ${url}`);
    await new Promise((listo) => setTimeout(listo, 2000 * intento));
  }
}

function sinEtiquetas(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function descargarFoto(foto: FotoDePrueba): Promise<FotoDePrueba> {
  const consulta = new URLSearchParams({
    action: "query",
    format: "json",
    titles: foto.titulo,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "960",
  });
  const datos = (await (await pedir(`${API}?${consulta}`)).json()) as RespuestaDeCommons;
  const info = Object.values(datos.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!info) throw new Error(`${foto.archivo}: no existe ${foto.titulo} en Commons.`);

  const licencia = info.extmetadata?.LicenseShortName?.value ?? "";
  if (!LICENCIA_LIBRE.test(licencia)) {
    throw new Error(`${foto.archivo}: la licencia "${licencia}" no es libre.`);
  }

  const original = Buffer.from(await (await pedir(info.thumburl)).arrayBuffer());
  await writeFile(join(CARPETA_DE_FOTOS, foto.archivo), await recortarFoto(original));

  return {
    ...foto,
    autor: sinEtiquetas(info.extmetadata?.Artist?.value ?? "") || "Autor no indicado",
    licencia,
    licencia_url: info.extmetadata?.LicenseUrl?.value ?? "",
    fuente: info.descriptionurl,
  };
}

// Una foto por línea, para que los cambios se lean bien en un diff.
function comoTexto(fotos: FotoDePrueba[]): string {
  return `[\n${fotos.map((foto) => `  ${JSON.stringify(foto)}`).join(",\n")}\n]\n`;
}

if (import.meta.main) {
  const pedidas = process.argv.slice(2);
  await mkdir(CARPETA_DE_FOTOS, { recursive: true });
  const yaEstan = new Set(await readdir(CARPETA_DE_FOTOS));
  const fotos = await leerFotos();

  let bajadas = 0;
  for (const [indice, foto] of fotos.entries()) {
    const toca = pedidas.includes("--todas")
      ? true
      : pedidas.length > 0
        ? pedidas.includes(foto.archivo)
        : !yaEstan.has(foto.archivo);
    if (!toca) continue;
    fotos[indice] = await descargarFoto(foto);
    bajadas++;
    console.log(`${foto.archivo}  ←  ${foto.titulo}`);
  }

  await writeFile(ARCHIVO_DE_FOTOS, comoTexto(fotos), "utf8");
  console.log(`${bajadas} fotos escritas en ${CARPETA_DE_FOTOS}`);
}
