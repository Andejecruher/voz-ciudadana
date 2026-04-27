/**
 * WebhookParserService — Parsea y valida el payload del webhook de Meta.
 */
import { z } from 'zod';
import { WaWebhookPayload } from '../../types/whatsapp.types';
import { ParsedWebhookResult, parseWebhookPayload } from '../../utils/wa-message-parser';

const webhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.record(z.string(), z.unknown()),
        }),
      ),
    }),
  ),
});

export class WebhookParserService {
  /**
   * Valida la estructura mínima del payload de webhook usando Zod.
   * @throws ZodError si el payload es inválido
   */
  validate(payload: unknown): WaWebhookPayload {
    const result = webhookPayloadSchema.safeParse(payload);
    if (!result.success) {
      throw new Error(`Invalid webhook payload: ${result.error.message}`);
    }
    return payload as WaWebhookPayload;
  } /**
   * Parsea un payload ya validado y retorna mensajes y statuses separados.
   */
  parse(payload: WaWebhookPayload): ParsedWebhookResult {
    return parseWebhookPayload(payload);
  }

  /**
   * Verifica si el payload corresponde a WhatsApp Business.
   */
  isWhatsAppPayload(payload: WaWebhookPayload | null | undefined): boolean {
    return payload?.object === 'whatsapp_business_account';
  }
}
