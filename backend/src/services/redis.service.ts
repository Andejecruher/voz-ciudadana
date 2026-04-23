/**
 * Servicio de Redis usando ioredis.
 * Expone la instancia raw para operaciones get/set/del con TTL.
 */
import Redis from 'ioredis';
import { getEnv } from '../config/env.config';

export class RedisService {
  readonly client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      password: process.env['REDIS_PASSWORD'] || undefined,
      // Reconectar automáticamente en caso de corte
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.client.on('connect', () => console.log('[RedisService] Conectado a Redis'));
    this.client.on('error', (err) => console.error('[RedisService] Error de Redis:', err));
  }

  /** Cerrar conexión limpiamente. Llamar en process signal handlers. */
  async disconnect(): Promise<void> {
    await this.client.quit();
    console.log('[RedisService] Desconectado de Redis');
  }

  /** Obtener valor por clave */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** Guardar valor con TTL opcional en segundos */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  /** Eliminar clave */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
