CREATE SCHEMA IF NOT EXISTS "inventario";
--> statement-breakpoint
CREATE TABLE "inventario"."categorias" (
	"id" smallint PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"orden" smallint NOT NULL,
	CONSTRAINT "categorias_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "inventario"."productos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventario"."productos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"nombre_busqueda" text NOT NULL,
	"descripcion" text NOT NULL,
	"precio_centavos" integer NOT NULL,
	"foto_ruta" text NOT NULL,
	"categoria_id" smallint NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "productos_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "productos_precio_positivo" CHECK ("inventario"."productos"."precio_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "inventario"."stock" (
	"producto_id" integer PRIMARY KEY NOT NULL,
	"disponible" integer NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"actualizado" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_disponible_no_negativo" CHECK ("inventario"."stock"."disponible" >= 0)
);
--> statement-breakpoint
ALTER TABLE "inventario"."productos" ADD CONSTRAINT "productos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "inventario"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventario"."stock" ADD CONSTRAINT "stock_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "inventario"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "productos_categoria_nombre" ON "inventario"."productos" USING btree ("categoria_id","nombre");