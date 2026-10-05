import { FastifyAdapter } from "@nestjs/platform-fastify";

// Cuántos proxies hay delante del servicio. Con 0, la IP del cliente es la de la conexión
// y `X-Forwarded-For` se ignora, porque cualquiera lo puede escribir. Detrás de proxies,
// la IP del cliente se toma de esa cabecera, tantos saltos atrás como proxies haya.
function saltosDeProxy(): number {
  const texto = process.env.SALTOS_DE_PROXY;
  if (texto === undefined || texto === "") {
    return 0;
  }
  if (!/^\d+$/.test(texto)) {
    throw new Error("SALTOS_DE_PROXY debe ser un número entero.");
  }
  return Number(texto);
}

// El adaptador de Fastify, igual en el servicio y en sus pruebas.
export function adaptadorHttp(): FastifyAdapter {
  const saltos = saltosDeProxy();
  // El salto 0 es quien abre la conexión; se confía en los `saltos` más cercanos al servicio.
  return new FastifyAdapter({ trustProxy: (_direccion, salto) => salto < saltos });
}
