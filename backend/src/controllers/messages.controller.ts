/**
 * MessagesController — HTTP adapter para mensajes outbound y attachments.
 *
 * Todos los endpoints requieren JWT auth (via middleware).
 * La lógica de envío está en OutboxProcessorService (via MessageService).
 * La lógica de attachments está en MessageService.
 */
import * as crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { OutboxProcessorService } from '../services/events/outbox-processor.service';
import { MessageService } from '../services/message.service';
import { WaTextOutbound } from '../types/whatsapp.types';

const sendTextSchema = z.object({
  to: z.string().min(10),
  body: z.string().min(1).max(4096),
  conversationId: z.string().uuid().optional(),
});

const IdParam = z.object({ id: z.string().uuid() });

const AddAttachmentBody = z.object({
  storageKey: z.string().min(1).max(1024),
  mimeType: z.string().min(1).max(127),
  /** Tamaño en bytes — se envía como string para evitar pérdida de precisión BigInt en JSON */
  fileSizeBytes: z.string().regex(/^\d+$/, 'fileSizeBytes debe ser un entero positivo'),
  originalFilename: z.string().max(512).optional(),
  cdnUrl: z.string().url().optional(),
});

export class MessagesController {
  constructor(
    private readonly outboxProcessor: OutboxProcessorService,
    private readonly messageService: MessageService,
  ) {}

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

  /**
   * POST /api/v1/messages/:id/attachments
   * Registra un attachment sobre un mensaje existente.
   * El cliente sube el archivo al storage y envía los metadatos resultantes.
   */
  addAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = IdParam.parse(req.params);
      const uploadedBy = req.user?.id;
      if (!uploadedBy) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const data = AddAttachmentBody.parse(req.body);

      const attachment = await this.messageService.addAttachment({
        messageId: id,
        storageKey: data.storageKey,
        mimeType: data.mimeType,
        fileSizeBytes: BigInt(data.fileSizeBytes),
        originalFilename: data.originalFilename,
        cdnUrl: data.cdnUrl,
        uploadedBy,
      });

      res.status(201).json({ attachment });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };
}
