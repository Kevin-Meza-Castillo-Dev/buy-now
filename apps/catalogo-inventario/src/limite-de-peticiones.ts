import { error } from "@buy-now/contratos";
import {
  Inject,
  Injectable,
  Module,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { ApiTooManyRequestsResponse } from "@nestjs/swagger";
import type { Redis } from "ioredis";
import { PREFIJO_DEL_LIMITE } from "./claves-de-redis.ts";
import { esquemaDe } from "./documentacion.ts";
import { ErrorDeApi } from "./error-de-api.ts";
import { ModuloRedis, REDIS } from "./redis.ts";

const LIMITE_POR_DEFECTO = 300;
const VENTANA_EN_SEGUNDOS = 60;

const SIN_LIMITE = "sin_limite_de_peticiones";

// Para los controladores cuyas peticiones no cuentan: las fotos, que son archivos fijos y
// llegan de a 20 por pantalla.
export const SinLimiteDePeticiones = (): ClassDecorator => SetMetadata(SIN_LIMITE, true);

// La respuesta 429, para la documentación de los controladores que sí cuentan.
export const RespuestaDeLimite = (): ClassDecorator & MethodDecorator =>
  ApiTooManyRequestsResponse({
    description: "`demasiadas_peticiones`: esta IP pasó el límite de peticiones por minuto.",
    schema: esquemaDe(error),
  });

// Peticiones por minuto que se aceptan de una IP. 0 lo desactiva, para la prueba de carga.
function limiteConfigurado(): number {
  const texto = process.env.LIMITE_DE_PETICIONES_POR_MINUTO;
  if (texto === undefined || texto === "") {
    return LIMITE_POR_DEFECTO;
  }
  if (!/^\d+$/.test(texto)) {
    throw new Error(
      "LIMITE_DE_PETICIONES_POR_MINUTO debe ser un número entero, o 0 para no limitar.",
    );
  }
  return Number(texto);
}

// Limita las peticiones de cada IP con un contador por minuto de reloj en Redis, que
// comparten todas las réplicas. Es una protección accesoria: si Redis no responde, no limita.
@Injectable()
export class LimiteDePeticiones implements CanActivate {
  private readonly limite = limiteConfigurado();

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    if (this.limite === 0 || this.reflector.get<boolean>(SIN_LIMITE, contexto.getClass())) {
      return true;
    }
    const { ip } = contexto.switchToHttp().getRequest<{ ip: string }>();
    const minuto = Math.floor(Date.now() / (VENTANA_EN_SEGUNDOS * 1000));
    const clave = `${PREFIJO_DEL_LIMITE}${ip}:${minuto}`;

    let peticiones: number;
    try {
      const respuestas = await this.redis
        .multi()
        .incr(clave)
        .expire(clave, VENTANA_EN_SEGUNDOS)
        .exec();
      peticiones = Number(respuestas?.[0]?.[1]);
    } catch {
      return true;
    }
    if (peticiones > this.limite) {
      throw new ErrorDeApi(
        429,
        "demasiadas_peticiones",
        "Hiciste demasiadas peticiones. Espera un momento y vuelve a intentar.",
      );
    }
    return true;
  }
}

@Module({
  imports: [ModuloRedis],
  providers: [{ provide: APP_GUARD, useClass: LimiteDePeticiones }],
})
export class ModuloLimiteDePeticiones {}
