import { defineConfig } from "vitest/config";

// Pruebas de integración: van contra el Redis de REDIS_URL y el Kafka de KAFKA_BROKERS.
// Comparten el topic, así que los archivos corren uno tras otro.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
