import { eventoStockCambiado, TOPIC_INVENTARIO } from "@buy-now/contratos";
import { KafkaJS } from "@confluentinc/kafka-javascript";
import type { Redis } from "ioredis";
import { escribirStock } from "./escribir-stock.ts";

export type Consumidor = {
  // Deja de leer, termina el mensaje en curso, confirma su posición y se desconecta.
  detener(): Promise<void>;
};

type Opciones = {
  brokers: string[];
  grupo: string;
  redis: Redis;
  avisar?: (mensaje: string) => void;
};

// Lee `inventario.eventos` y deja en Redis el stock visible de cada producto (RF-009).
// Un grupo nuevo lee el topic desde el principio, así reconstruye lo que Redis no tenga.
export async function consumir(opciones: Opciones): Promise<Consumidor> {
  const avisar = opciones.avisar ?? ((mensaje: string) => console.warn(mensaje));
  const kafka = new KafkaJS.Kafka({
    kafkaJS: { brokers: opciones.brokers, logLevel: KafkaJS.logLevel.ERROR },
  });
  const consumidor = kafka.consumer({
    kafkaJS: { groupId: opciones.grupo, fromBeginning: true },
  });

  await consumidor.connect();
  await consumidor.subscribe({ topic: TOPIC_INVENTARIO });
  await consumidor.run({
    eachMessage: async ({ message, partition }) => {
      const evento = leerEvento(message.value);
      if (!evento) {
        // Un mensaje que no se entiende no se va a entender al reintentarlo: se salta,
        // para no detener los eventos que vienen detrás.
        avisar(
          `Se saltó el mensaje ${message.offset} de la partición ${partition}: ` +
            "no es un evento de stock válido.",
        );
        return;
      }
      // Si Redis no responde, esto falla y el mensaje se vuelve a leer: no se pierde.
      await escribirStock(opciones.redis, evento.datos);
    },
  });

  return { detener: () => consumidor.disconnect() };
}

function leerEvento(valor: Buffer | null) {
  if (!valor) {
    return undefined;
  }
  try {
    return eventoStockCambiado.safeParse(JSON.parse(valor.toString("utf8"))).data;
  } catch {
    return undefined;
  }
}
