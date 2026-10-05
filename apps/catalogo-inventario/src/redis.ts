import { Inject, Injectable, Logger, Module, type OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";

export const REDIS = Symbol("REDIS");

const ESPERA_DE_CONEXION_MS = 1000;
const ESPERA_DE_COMANDO_MS = 500;
const MAYOR_PAUSA_ENTRE_REINTENTOS_MS = 2000;

// Redis es accesorio: si no responde, el servicio sigue con Postgres. Por eso un comando
// falla enseguida en vez de quedar en cola, y la conexión se reintenta sola por detrás.
async function conectar(): Promise<Redis> {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("Falta REDIS_URL.");
  }
  const bitacora = new Logger("Redis");
  const redis = new Redis(url, {
    enableOfflineQueue: false,
    connectTimeout: ESPERA_DE_CONEXION_MS,
    commandTimeout: ESPERA_DE_COMANDO_MS,
    maxRetriesPerRequest: 0,
    retryStrategy: (intentos) => Math.min(intentos * 200, MAYOR_PAUSA_ENTRE_REINTENTOS_MS),
  });

  // Se avisa una vez al caer y una vez al volver, no en cada reintento.
  let caido = false;
  redis.on("error", (error: Error) => {
    if (!caido) {
      caido = true;
      bitacora.warn(`Redis no responde; se lee de Postgres. ${error.message}`);
    }
  });
  redis.on("ready", () => {
    if (caido) {
      caido = false;
      bitacora.log("Redis volvió a responder.");
    }
  });

  // Se espera un momento a la primera conexión, para que las primeras peticiones ya lean
  // de Redis. Si no llega, el servicio arranca igual.
  await new Promise<void>((listo) => {
    const espera = setTimeout(listo, ESPERA_DE_CONEXION_MS);
    const terminar = (): void => {
      clearTimeout(espera);
      listo();
    };
    redis.once("ready", terminar);
    redis.once("error", terminar);
  });
  return redis;
}

// Cierra la conexión a Redis cuando el servicio se detiene.
@Injectable()
class CierreDeRedis implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}

@Module({
  providers: [{ provide: REDIS, useFactory: conectar }, CierreDeRedis],
  exports: [REDIS],
})
export class ModuloRedis {}
