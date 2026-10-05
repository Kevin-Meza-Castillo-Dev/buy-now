import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { PREFIJO_DEL_CATALOGO } from "../claves-de-redis.ts";
import { REDIS } from "../redis.ts";

const VIGENCIA_EN_SEGUNDOS = 60;

// Guarda las respuestas del catálogo 60 segundos en Redis, sin el stock (CE-001). Es una
// ayuda: si Redis no responde o el valor guardado no sirve, se lee de Postgres.
@Injectable()
export class CacheDelCatalogo {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  // Devuelve lo guardado en la clave. Si no hay nada, lo pide a `leer` y lo guarda, salvo
  // que `seGuarda` diga que no.
  async leer<T>(
    clave: string,
    leer: () => Promise<T>,
    seGuarda: (valor: T) => boolean = () => true,
  ): Promise<T> {
    const completa = `${PREFIJO_DEL_CATALOGO}${clave}`;
    try {
      const guardado = await this.redis.get(completa);
      if (guardado !== null) {
        return JSON.parse(guardado) as T;
      }
    } catch {
      // Redis caído o valor dañado: se lee de Postgres.
    }

    const valor = await leer();
    if (seGuarda(valor)) {
      try {
        await this.redis.set(completa, JSON.stringify(valor), "EX", VIGENCIA_EN_SEGUNDOS);
      } catch {
        // Sin Redis, la próxima lectura vuelve a Postgres.
      }
    }
    return valor;
  }
}
