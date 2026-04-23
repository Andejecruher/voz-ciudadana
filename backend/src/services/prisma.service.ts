/**
 * Wrapper singleton de PrismaClient.
 * Se conecta al iniciar la app y desconecta al recibir señal de cierre.
 */
import { PrismaClient } from '@prisma/client';

export class PrismaService extends PrismaClient {
  constructor() {
    super();
  }

  /** Conecta al motor de base de datos. Llamar al iniciar la app. */
  async connect(): Promise<void> {
    await this.$connect();
    console.log('[PrismaService] Conectado a la base de datos');
  }

  /** Desconecta limpiamente. Llamar en process signal handlers. */
  async disconnect(): Promise<void> {
    await this.$disconnect();
    console.log('[PrismaService] Desconectado de la base de datos');
  }
}
