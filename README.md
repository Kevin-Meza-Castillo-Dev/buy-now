# Buy Now

Sistema de pedidos con catálogo, inventario y una app móvil para el cliente. El catálogo se ve sin cuenta; para agregar un producto, entrar al carrito y pedir, el comprador inicia sesión.

La regla central: el stock se reserva al entrar al carrito y ninguna unidad se promete a dos clientes.

## Estado

En construcción. Hoy existen el monorepo, la configuración compartida y los contratos de las API y de los eventos. Los servicios y la app todavía no.

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
| `pnpm -r test` | Pruebas unitarias |
| `pnpm run formato` | Aplica Prettier; `formato:revisar` solo comprueba |
| `pnpm --filter catalogo-inventario fotos:descargar` | Baja las fotos de `datos/fotos.json` que falten en `fotos/` y las recorta |

## Fotos de los productos

Las fotos de los productos de prueba están en `apps/catalogo-inventario/fotos/`. Son fotos reales con licencia libre, tomadas de [Wikimedia Commons](https://commons.wikimedia.org), una por tipo de producto. El autor, la licencia y la fuente de cada una están en `apps/catalogo-inventario/datos/fotos.json`.

Algunas muestran envases con marcas reales. Esas marcas pertenecen a sus dueños y no tienen relación con este proyecto.

## Cómo se trabaja

- Cada cambio va en una rama nueva y entra a `main` por un pull request, con el CI en verde.
- La prueba se escribe antes que el código.
- No se guardan secretos en el repositorio: la configuración entra por variables de entorno.
