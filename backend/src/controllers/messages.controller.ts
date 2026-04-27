/**
 * MessagesController — HTTP adapter para envío de mensajes outbound desde el dashboard.
 *
 * Todos los endpoints requieren JWT auth (via middleware).
 * La lógica está en OutboxProcessorService.
 */
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { OutboxProcessorService } from '../services/events/outbox-processor.service';
import { WaTextOutbound } from '../types/whatsapp.types';

const sendTextSchema = z.object({
  to: z.string().min(10),
  body: z.string().min(1).max(4096),
  conversationId: z.string().uuid().optional(),
});

export class MessagesController {
  constructor(private readonly outboxProcessor: OutboxProcessorService) {}

  /**
   * POST /api/v1/messages/text
   * Envía un mensaje de texto a un ciudadano (desde agente/dashboard).
   */
  sendText = async (req: Request, res: Response): Promise<void> => {
    const parsed = sendTextSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Payload inválido', details: parsed.error.flatten() });
      return;
    }

    const { to, body, conversationId } = parsed.data;
    const idempotencyKey = crypto.randomUUID();

    const payload: WaTextOutbound = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body },
    };

    try {
      await this.outboxProcessor.enqueue(to, payload, idempotencyKey, conversationId);
      res.status(202).json({ status: 'queued', idempotencyKey });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error interno';
      res.status(500).json({ error: message });
    }
  };
}
