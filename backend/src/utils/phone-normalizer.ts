/**
 * Normalización de números de teléfono a formato E.164.
 * Especializado para México / Cintalapa, Chiapas.
 *
 * Formato canónico en DB: solo dígitos, sin "+".
 * Ej: "521234567890" (no "+521234567890")
 */

/**
 * Normaliza un número de teléfono al formato canónico de almacenamiento en DB:
 * solo dígitos, sin "+", sin espacios, sin guiones.
 *
 * Este es el formato que se guarda SIEMPRE en la tabla citizens.phone.
 * Todos los lookups y creaciones deben usar esta función.
 *
 * Ejemplos:
 *   "+521234567890" → "521234567890"
 *   "521234567890"  → "521234567890"
 *   "+52 961 234 5678" → "5219612345678"
 *
 * @param raw - Número crudo (con o sin +, con o sin espacios/guiones)
 * @returns Número con solo dígitos (formato DB canónico)
 */
export function normalizePhoneForStorage(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

/**
 * Normaliza un número de teléfono recibido de Meta a formato E.164 con "+".
 * Solo usar para envío outbound vía WhatsApp API o display al usuario.
 * NO usar para guardar en DB — usar normalizePhoneForStorage para eso.
 *
 * @param raw - Número crudo (con o sin +)
 * @returns Número normalizado en E.164 con + (ej: "+521234567890")
 */
export function normalizePhone(raw: string): string {
  // Eliminar espacios, guiones, paréntesis
  const cleaned = raw.replace(/[\s\-().]/g, '');

  // Si ya tiene + al inicio, retornar tal cual
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Meta envía números sin +; agregar + al inicio
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return `+${cleaned}`;
  }

  return cleaned;
}

/**
 * Verifica si un número tiene el prefijo de México (+52).
 */
export function isMexicanNumber(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return normalized.startsWith('+52');
}

/**
 * Formatea un número E.164 para mostrar al usuario.
 * Ej: +5219612345678 → +52 961 234 5678
 */
export function formatPhoneDisplay(e164: string): string {
  if (!e164.startsWith('+52') || e164.length < 13) return e164;
  const digits = e164.slice(3); // quitar +52
  if (digits.length === 10) {
    return `+52 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return e164;
}
