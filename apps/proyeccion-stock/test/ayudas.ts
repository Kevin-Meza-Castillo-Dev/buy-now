import { randomInt, randomUUID } from "node:crypto";
import {
  TIPO_STOCK_CAMBIADO,
  TOPIC_INVENTARIO,
  type EventoStockCambiado,
  type StockCambiado,
} from "@buy-now/contratos";
import { KafkaJS } from "@confluentinc/kafka-javascript";
import { Redis } from "ioredis";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta ${nombre}: las pruebas de integración lo necesitan.`);
  }
  return valor;
}

export function brokersDeKafka(): string[] {
  return variable("KAFKA_BROKERS").split(",");
}

// Las pruebas de `catalogo-inventario` corren a la vez que estas y vacían su base de Redis
// en cada prueba. Por eso estas usan la base 14 del mismo Redis, sea cual sea la de la URL.
// Se cambia en la URL porque `ioredis` prefiere la base de la URL a la de las opciones.
const BASE_DE_ESTAS_PRUEBAS = 14;

export function abrirRedis(): Redis {
  const url = new URL(variable("REDIS_URL"));
  url.pathname = `/${BASE_DE_ESTAS_PRUEBAS}`;
  return new Redis(url.toString());
}

// Un id que ninguna otra prueba usa, para que no importe lo que ya haya en el topic.
export function productoDePrueba(): number {
  return randomInt(1_000_000, 2_000_000_000);
}

export function eventoDeStock(datos: Omit<StockCambiado, "motivo">): EventoStockCambiado {
  return {
    id: randomUUID(),
    tipo: TIPO_STOCK_CAMBIADO,
    ocurrido_en: new Date().toISOString(),
    datos: { ...datos, motivo: "reserva" },
  };
}

function kafka(): KafkaJS.Kafka {
  return new KafkaJS.Kafka({ kafkaJS: { brokers: brokersDeKafka() } });
}

// Crea el topic si no existe. En la producción lo crea un script; aquí, la prueba.
export async function crearTopic(): Promise<void> {
  const admin = kafka().admin();
  await admin.connect();
  try {
    const existentes = await admin.listTopics();
    if (!existentes.includes(TOPIC_INVENTARIO)) {
      await admin.createTopics({ topics: [{ topic: TOPIC_INVENTARIO, numPartitions: 1 }] });
    }
  } finally {
    await admin.disconnect();
  }
}

// Publica los mensajes en `inventario.eventos`, en orden. Un texto se envía tal cual.
export async function publicar(
  clave: number,
  mensajes: (EventoStockCambiado | string)[],
): Promise<void> {
  const productor = kafka().producer();
  await productor.connect();
  try {
    await productor.send({
      topic: TOPIC_INVENTARIO,
      messages: mensajes.map((mensaje) => ({
        key: String(clave),
        value: typeof mensaje === "string" ? mensaje : JSON.stringify(mensaje),
      })),
    });
  } finally {
    await productor.disconnect();
  }
}

// Espera hasta que `condicion` se cumpla. El consumidor tarda unos segundos en unirse a
// su grupo antes de leer el primer mensaje.
export async function esperarA(
  condicion: () => Promise<boolean>,
  esperaMs = 25_000,
): Promise<void> {
  const limite = Date.now() + esperaMs;
  while (!(await condicion())) {
    if (Date.now() > limite) {
      throw new Error("Se acabó la espera y la condición no se cumplió.");
    }
    await new Promise((listo) => setTimeout(listo, 200));
  }
}
