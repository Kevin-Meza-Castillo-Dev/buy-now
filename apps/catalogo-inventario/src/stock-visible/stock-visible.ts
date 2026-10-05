import { Inject, Injectable } from "@nestjs/common";
import { inArray } from "drizzle-orm";
import type { Redis } from "ioredis";
import { BASE_DE_DATOS, type BaseDeDatos } from "../db/base.ts";
import { stock } from "../db/esquema.ts";
import { REDIS } from "../redis.ts";

// Los ids de producto son integer. Un número mayor no es de ningún producto, y Postgres
// lo rechazaría al compararlo.
const MAYOR_ID_DE_PRODUCTO = 2_147_483_647;

// Escribe la clave solo si no existe o si guarda una versión menor, para no pisar un
// valor más nuevo que haya dejado `proyeccion-stock`.
const ESCRIBIR_SI_ES_MAS_NUEVO = `
local guardada = redis.call('HGET', KEYS[1], 'version')
if guardada and tonumber(guardada) >= tonumber(ARGV[2]) then
  return 0
end
redis.call('HSET', KEYS[1], 'disponible', ARGV[1], 'version', ARGV[2])
return 1
`;

function clave(productoId: number): string {
  return `stock:${productoId}`;
}

// El stock que se muestra. Se lee de Redis, donde lo mantiene `proyeccion-stock`; si falta
// una clave o Redis no responde, se lee de Postgres (RF-009). Nunca decide una venta: eso
// lo hace la reserva.
@Injectable()
export class StockVisible {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(BASE_DE_DATOS) private readonly base: BaseDeDatos,
  ) {}

  // Las unidades disponibles de cada producto. Un id sin stock no aparece en el resultado.
  async de(productoIds: number[]): Promise<Map<number, number>> {
    const ids = [...new Set(productoIds)].filter((id) => id <= MAYOR_ID_DE_PRODUCTO);
    const disponibles = new Map<number, number>();
    if (ids.length === 0) {
      return disponibles;
    }

    const redisResponde = await this.leerDeRedis(ids, disponibles);
    const faltan = ids.filter((id) => !disponibles.has(id));
    if (faltan.length === 0) {
      return disponibles;
    }

    const filas = await this.base
      .select({ id: stock.productoId, disponible: stock.disponible, version: stock.version })
      .from(stock)
      .where(inArray(stock.productoId, faltan));
    for (const fila of filas) {
      disponibles.set(fila.id, fila.disponible);
    }
    if (redisResponde) {
      await this.escribirEnRedis(filas);
    }
    return disponibles;
  }

  // Llena `disponibles` con las claves que existan. Dice si Redis respondió.
  private async leerDeRedis(ids: number[], disponibles: Map<number, number>): Promise<boolean> {
    try {
      const lectura = this.redis.pipeline();
      for (const id of ids) {
        lectura.hget(clave(id), "disponible");
      }
      const respuestas = (await lectura.exec()) ?? [];
      respuestas.forEach(([error, valor], indice) => {
        if (!error && typeof valor === "string") {
          disponibles.set(ids[indice]!, Number(valor));
        }
      });
      return respuestas.length === ids.length && respuestas.every(([error]) => !error);
    } catch {
      return false;
    }
  }

  // Dejar la clave escrita es una ayuda para la próxima lectura: si falla, no importa.
  private async escribirEnRedis(
    filas: { id: number; disponible: number; version: number }[],
  ): Promise<void> {
    try {
      const escritura = this.redis.pipeline();
      for (const fila of filas) {
        escritura.eval(ESCRIBIR_SI_ES_MAS_NUEVO, 1, clave(fila.id), fila.disponible, fila.version);
      }
      await escritura.exec();
    } catch {
      // Sin Redis, la próxima lectura vuelve a Postgres.
    }
  }
}
