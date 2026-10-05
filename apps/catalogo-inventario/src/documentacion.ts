import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule, type ApiResponseOptions } from "@nestjs/swagger";
import { z } from "zod";

type Esquema = NonNullable<Extract<ApiResponseOptions, { schema?: unknown }>["schema"]>;

// El esquema de OpenAPI sale del esquema Zod del contrato, para que la documentación no
// se escriba dos veces ni se aparte de lo que el servicio valida.
export function esquemaDe(contrato: z.ZodType): Esquema {
  const esquema = z.toJSONSchema(contrato, { target: "openapi-3.0" }) as Record<string, unknown>;
  delete esquema.$schema;
  return esquema as Esquema;
}

// Publica Swagger en /docs y el documento OpenAPI en /docs-json. Se llama antes de
// iniciar la aplicación. Es una ayuda de desarrollo: con NODE_ENV=production no se monta.
export function montarDocumentacion(app: NestFastifyApplication): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  const configuracion = new DocumentBuilder()
    .setTitle("Buy Now: catálogo e inventario")
    .setDescription("Productos, categorías, stock visible y fotos. El catálogo no exige sesión.")
    .setVersion("0.1.0")
    .build();
  SwaggerModule.setup("docs", app, () => SwaggerModule.createDocument(app, configuracion));
}
