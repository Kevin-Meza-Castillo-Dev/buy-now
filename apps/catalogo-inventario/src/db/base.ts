import { Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

export const BASE_DE_DATOS = Symbol("BASE_DE_DATOS");
export type BaseDeDatos = NodePgDatabase;

const CONEXIONES = Symbol("CONEXIONES");

// Cierra las conexiones a Postgres cuando el servicio se detiene.
@Injectable()
class CierreDeConexiones implements OnModuleDestroy {
  constructor(@Inject(CONEXIONES) private readonly conexiones: pg.Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.conexiones.end();
  }
}

@Module({
  providers: [
    {
      provide: CONEXIONES,
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
          throw new Error("Falta DATABASE_URL.");
        }
        return new pg.Pool({ connectionString: databaseUrl });
      },
    },
    {
      provide: BASE_DE_DATOS,
      useFactory: (conexiones: pg.Pool): BaseDeDatos => drizzle(conexiones),
      inject: [CONEXIONES],
    },
    CierreDeConexiones,
  ],
  exports: [BASE_DE_DATOS],
})
export class ModuloBaseDeDatos {}
