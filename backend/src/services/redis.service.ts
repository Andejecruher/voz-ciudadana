/**
 * Servicio de Redis usando ioredis.
 * Expone la instancia raw para operaciones get/set/del con TTL.
 * Incluye helpers para incr/ttl y escaneo de claves por patrón
 * (usados por rate-limit, lockout y multi-sesión).
 */
import Redis from 'ioredis';
import { env } from '../config/env.config';

export class RedisService {
  readonly client: Redis;

  constructor() {
    this.client = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      username: 'default',
      password: env.REDIS_PASSWORD,
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

  /** Eliminar clave (o múltiples claves) */
  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  /**
   * Incrementa un contador entero en Redis y (opcionalmente) establece TTL
   * solo en la primera escritura (cuando el contador pasa de 0 a 1).
   * Retorna el valor actual del contador.
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const value = await this.client.incr(key);
    if (value === 1 && ttlSeconds) {
      await this.client.expire(key, ttlSeconds);
    }
    return value;
  }

  /** Obtiene el TTL restante en segundos. -2 = no existe, -1 = sin expiración */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * Retorna todas las claves que coinciden con el patrón (SCAN iterativo).
   * USAR CON PRECAUCIÓN — en producción con bases grandes, preferir prefijos exclusivos
   * y estructuras de datos específicas (SMEMBERS, HKEYS).
   */
  async keys(pattern: string): Promise<string[]> {
    const results: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      results.push(...keys);
    } while (cursor !== '0');
    return results;
  }

  /**
   * Agrega un miembro a un Redis Set con TTL opcional en la primera escritura.
   * Usado para gestión de sesiones por usuario.
   */
  async sadd(key: string, member: string, ttlSeconds?: number): Promise<void> {
    await this.client.sadd(key, member);
    // Refrescar TTL solo si ya existe — no queremos reducir TTL accidentalmente
    const currentTtl = await this.client.ttl(key);
    if (currentTtl === -1 && ttlSeconds) {
      await this.client.expire(key, ttlSeconds);
    }
  }

  /** Elimina miembro de un Set */
  async srem(key: string, member: string): Promise<void> {
    await this.client.srem(key, member);
  }

  /** Retorna todos los miembros de un Set */
  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }
}
