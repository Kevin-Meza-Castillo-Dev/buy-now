import { writeFile } from "node:fs/promises";
import { ARCHIVO_DE_DATOS, type DatosDePrueba, type ProductoDePrueba } from "./datos.ts";
import { SURTIDO } from "./surtido.ts";

// Genera el conjunto fijo de datos de prueba de RF-012: 12 categorías y 125 productos
// de supermercado en cada una. La semilla es fija, así que cada corrida da lo mismo.

const SEMILLA = 20261004;

// Generador de números al azar con semilla (mulberry32), para no depender de Math.random.
function azarConSemilla(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generarDatos(): DatosDePrueba {
  const azar = azarConSemilla(SEMILLA);
  const entero = (minimo: number, maximo: number) =>
    minimo + Math.floor(azar() * (maximo - minimo + 1));

  // Cerca del 70 % con más de 5 unidades, 20 % entre 1 y 5 y 10 % en 0.
  const stockInicial = () => {
    const sorteo = azar();
    if (sorteo < 0.1) return 0;
    if (sorteo < 0.3) return entero(1, 5);
    return entero(6, 120);
  };

  const categorias = SURTIDO.map((categoria, indice) => ({
    id: indice + 1,
    nombre: categoria.nombre,
    orden: indice + 1,
  }));

  const productos: ProductoDePrueba[] = [];
  SURTIDO.forEach((categoria, indice) => {
    for (const [base, precioBase] of categoria.bases) {
      for (const [presentacion, factor] of categoria.presentaciones) {
        const marca = categoria.marcas[entero(0, categoria.marcas.length - 1)]!;
        const codigo = `SUP-${String(productos.length + 1).padStart(4, "0")}`;
        // El precio varía hasta un 8 % alrededor del de referencia y se redondea a 5 centavos.
        const precio = precioBase * factor * (0.92 + azar() * 0.16);
        productos.push({
          codigo,
          nombre: `${base} ${marca} ${presentacion}`,
          descripcion: `${base} de la marca ${marca}, en presentación de ${presentacion}. ${categoria.frase}`,
          precio_centavos: Math.max(5, Math.round(precio / 5) * 5),
          foto_ruta: `${codigo}.webp`,
          categoria_id: indice + 1,
          activo: true,
          stock_inicial: stockInicial(),
        });
      }
    }
  });

  return { categorias, productos };
}

// Un producto por línea, para que los cambios se lean bien en un diff.
function comoTexto(datos: DatosDePrueba): string {
  const lineas = (filas: object[]) =>
    filas.map((fila) => `    ${JSON.stringify(fila)}`).join(",\n");
  return `{\n  "categorias": [\n${lineas(datos.categorias)}\n  ],\n  "productos": [\n${lineas(datos.productos)}\n  ]\n}\n`;
}

if (import.meta.main) {
  const datos = generarDatos();
  await writeFile(ARCHIVO_DE_DATOS, comoTexto(datos), "utf8");
  console.log(`${datos.productos.length} productos escritos en ${ARCHIVO_DE_DATOS}`);
}
