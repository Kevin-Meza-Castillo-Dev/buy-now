import type { StockCambiado } from "@buy-now/contratos";
import type { Redis } from "ioredis";

// Escribe la clave solo si no existe o si guarda una versión menor. Va en un script para
// que comparar y escribir sea un solo paso: así un evento repetido o atrasado no pisa un
// valor más nuevo, aunque varios procesos escriban a la vez.
const ESCRIBIR_SI_ES_MAS_NUEVO = `
local guardada = redis.call('HGET', KEYS[1], 'version')
if guardada and tonumber(guardada) >= tonumber(ARGV[2]) then
  return 0
end
redis.call('HSET', KEYS[1], 'disponible', ARGV[1], 'version', ARGV[2])
return 1
`;

// Deja en Redis el stock visible de un producto: `stock:{producto_id}`, un hash con
// `disponible` y `version`, sin vencimiento (RF-009). Dice si la clave cambió.
export async function escribirStock(
  redis: Redis,
  stock: Pick<StockCambiado, "producto_id" | "disponible" | "version">,
): Promise<boolean> {
  const escrito = await redis.eval(
    ESCRIBIR_SI_ES_MAS_NUEVO,
    1,
    `stock:${stock.producto_id}`,
    stock.disponible,
    stock.version,
  );
  return escrito === 1;
}
