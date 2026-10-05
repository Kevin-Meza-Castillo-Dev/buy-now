import { Redis } from "ioredis";
import { consumir } from "./consumidor.ts";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta ${nombre}.`);
  }
  return valor;
}

const redis = new Redis(variable("REDIS_URL"), { maxRetriesPerRequest: 1 });
redis.on("error", (error: Error) => console.warn(`Redis no responde. ${error.message}`));

const consumidor = await consumir({
  brokers: variable("KAFKA_BROKERS").split(","),
  grupo: "proyeccion-stock",
  redis,
});
console.log("proyeccion-stock está leyendo inventario.eventos.");

// Apagado ordenado: deja de leer, confirma su posición en Kafka y se desconecta.
let deteniendo = false;
async function detener(): Promise<void> {
  if (deteniendo) {
    return;
  }
  deteniendo = true;
  await consumidor.detener();
  redis.disconnect();
}
process.on("SIGTERM", () => void detener());
process.on("SIGINT", () => void detener());
