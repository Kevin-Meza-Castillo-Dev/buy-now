# Buy Now

Sistema de pedidos con catálogo, inventario y una app móvil para el cliente. El catálogo se ve sin cuenta; para agregar un producto, entrar al carrito y pedir, el comprador inicia sesión.

La regla central: el stock se reserva al entrar al carrito y ninguna unidad se promete a dos clientes.

## Estado

En construcción. Hoy existen el monorepo, los contratos de las API y de los eventos, y el comienzo de `catalogo-inventario`: el modelo de datos, los 1.500 productos de prueba con sus fotos y los endpoints del catálogo: categorías, lista de productos con páginas, búsqueda por nombre y filtro por categoría, detalle de un producto, fotos y stock visible, que se lee de Redis y, si Redis no responde, de Postgres. Las respuestas del catálogo se guardan 60 segundos en Redis, y cada IP tiene un límite de peticiones por minuto. También existe `proyeccion-stock`, que lee los eventos de stock de Kafka y mantiene el stock visible en Redis; todavía nadie publica esos eventos, porque la reserva no existe. Los demás servicios y la app todavía no.

## Partes

| Parte | Qué es |
| --- | --- |
| `packages/contratos` | Esquemas de los endpoints y de los eventos, con Zod |
| `apps/catalogo-inventario` | API de productos, stock y reservas |
| `apps/pedidos` | API de cuentas, carrito y pedidos |
| `apps/publicador-eventos` | Lleva el outbox a Kafka |
| `apps/proyeccion-stock` | Consume Kafka y actualiza el stock visible en Redis |
| `apps/worker-avisos` | Consume Kafka y envía los correos |
| `movil` | App Flutter del cliente |
| `infra` | Docker Compose, scripts de despliegue y pruebas de carga |

## Stack

| Parte | Elección |
| --- | --- |
| Backend | TypeScript sobre Node.js 24, NestJS con Fastify, monorepo con pnpm workspaces |
| Datos | PostgreSQL 17 como fuente de verdad, con Drizzle ORM |
| Lecturas rápidas | Redis |
| Eventos | Kafka en modo KRaft, con patrón outbox |
| Avisos | Correo electrónico con Resend |
| App | Flutter, Riverpod, go_router y dio |
| Pruebas | Vitest y Supertest en el backend, flutter_test en la app y k6 para carga |
| Entrega | GitHub Actions y Docker Compose sobre una máquina virtual |

## Requisitos

- pnpm 9. Node 24 lo descarga pnpm por la configuración de `.npmrc`, sin importar el Node instalado.

## Comandos

Desde la raíz:

| Comando | Qué hace |
| --- | --- |
| `pnpm install` | Instala las dependencias |
| `pnpm -r lint` | ESLint en todos los paquetes |
| `pnpm -r typecheck` | Revisa los tipos en todos los paquetes |
| `pnpm -r build` | Compila los servicios a `dist/` |
| `pnpm -r test` | Pruebas unitarias |
| `pnpm run formato` | Aplica Prettier; `formato:revisar` solo comprueba |
| `pnpm --filter catalogo-inventario fotos:descargar` | Baja las fotos de `datos/fotos.json` que falten en `fotos/` y las recorta |

## Documentación del API

Swagger es solo para desarrollo: con `NODE_ENV=production` el servicio no lo publica. Con `catalogo-inventario` corriendo en local:

- Swagger: `http://localhost:3000/docs`. El documento OpenAPI está en `/docs-json`.
- Postman: importa `apps/catalogo-inventario/coleccion/catalogo-inventario.postman_collection.json`. La variable `url` apunta a `http://localhost:3000`.

Para arrancarlo hacen falta un Postgres y las variables `DATABASE_URL` y `REDIS_URL`. Si el Redis de `REDIS_URL` no responde, el servicio arranca igual y lee de Postgres. La carga de datos borra de Redis lo que guardaba del catálogo:

```sh
pnpm -r build
pnpm -r migrate
pnpm --filter catalogo-inventario datos:cargar
pnpm --filter catalogo-inventario start
```

Variables opcionales de `catalogo-inventario`:

| Variable | Qué hace | Por defecto |
| --- | --- | --- |
| `PUERTO` | Puerto en el que escucha | 3000 |
| `LIMITE_DE_PETICIONES_POR_MINUTO` | Peticiones por minuto que se aceptan de una IP; al pasarlo responde 429. Con 0 no limita. Las fotos no cuentan | 300 |
| `SALTOS_DE_PROXY` | Cuántos proxies hay delante, para tomar la IP del cliente de `X-Forwarded-For`. Con 0 la cabecera se ignora | 0 |

## Proyección de stock

`proyeccion-stock` lee el topic `inventario.eventos` de Kafka y escribe en Redis el stock visible de cada producto, en la clave `stock:{producto_id}`. Un evento repetido o atrasado no pisa un valor más nuevo, y un mensaje que no es un evento de stock se salta con un aviso. Necesita `REDIS_URL` y `KAFKA_BROKERS`, la lista de brokers separada por comas:

```sh
pnpm -r build
pnpm --filter proyeccion-stock start
```

## Fotos de los productos

Las fotos de los productos de prueba están en `apps/catalogo-inventario/fotos/`. Son fotos reales con licencia libre, tomadas de [Wikimedia Commons](https://commons.wikimedia.org), una por tipo de producto. El autor, la licencia y la fuente de cada una están en `apps/catalogo-inventario/datos/fotos.json`.

Algunas muestran envases con marcas reales. Esas marcas pertenecen a sus dueños y no tienen relación con este proyecto.

## Cómo se trabaja

- Cada cambio va en una rama nueva y entra a `main` por un pull request, con el CI en verde.
- La prueba se escribe antes que el código.
- No se guardan secretos en el repositorio: la configuración entra por variables de entorno.
