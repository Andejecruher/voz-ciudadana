/**
 * Fingerprint liviano de request para detección básica de anomalías.
 *
 * Computa una firma determinística a partir de datos disponibles en el request:
 * - IP del cliente (normalizada)
 * - User-Agent (primeros 200 chars)
 * - Accept-Language header
 * - X-Device-Id header (si lo provee el cliente)
 *
 * NO requiere cookies ni almacenamiento del lado del cliente.
 * NO es un sistema de tracking — se usa solo para detectar cambios
 * abruptos en la identidad del cliente entre login y refresh.
 *
 * Limitaciones conocidas:
 * - IPs dinámicas o proxies pueden generar falsos positivos.
 * - User-Agent puede ser spoofed fácilmente.
 * - Es una capa de detección, NO de prevención aislada.
 *
 * Para mayor robustez en producción, complementar con:
 * - TLS fingerprinting (JA3)
 * - Análisis de timing
 */
import crypto from 'crypto';
import type { Request } from 'express';
import { extractIp } from '../services/audit.service';

export interface RequestFingerprint {
  /** Hash SHA-256 de los señales disponibles */
  hash: string;
  /** IP normalizada usada en el cálculo */
  ip: string;
  /** User-Agent truncado */
  ua: string;
}

/**
 * Computa el fingerprint del request.
 * Retorna un hash SHA-256 de los signals disponibles.
 */
export function computeFingerprint(req: Request): RequestFingerprint {
  const ip = extractIp(req) ?? 'unknown';
  const ua = (req.headers['user-agent'] ?? 'unknown').substring(0, 200);
  const lang = req.headers['accept-language'] ?? '';
  const deviceId = req.headers['x-device-id'] ?? '';

  // Combinar signals con separador no ambiguo
  const signal = [ip, ua, lang, deviceId].join('|');
  const hash = crypto.createHash('sha256').update(signal).digest('hex');

  return { hash, ip, ua };
}

/**
 * Computa un fingerprint basado solo en ip+ua (sin device-id).
 * Útil para comparar entre login y refresh donde el device-id puede no estar.
 */
export function computeBaseFingerprint(ip: string, ua: string): string {
  const signal = [ip, ua].join('|');
  return crypto.createHash('sha256').update(signal).digest('hex');
}
