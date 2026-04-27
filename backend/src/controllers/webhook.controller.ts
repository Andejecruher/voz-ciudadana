/**
 * WebhookController — HTTP adapter para endpoints del webhook de WhatsApp.
 *
 * Flujo del POST:
 * 1. Parsear y validar payload
 * 2. Persistir InboxEvent en DB (para auditoría y replay)
 * 3. Log en WebhookEventLog
 * 4. Encolar en InboxProcessorService (Redis queue)
 * 5. Responder 200 OK inmediato a Meta (< 5s)
 *
 * La firma HMAC ya fue validada por metaSignature.middleware.ts.
 * La idempotencia ya fue verificada por idempotency.middleware.ts.
 */
import { Request, Response } from 'express';
import { env } from '../config/env.config';
import { InboxProcessorService } from '../services/events/inbox-processor.service';
import { PrismaService } from '../services/prisma.service';
import { MessageRepository } from '../services/repositories/message.repository';
import { WebhookParserService } from '../services/whatsapp/webhook-parser.service';
import { WaWebhookPayload } from '../types/whatsapp.types';

export class WebhookController {
  private readonly verifyToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inboxProcessor: InboxProcessorService,
    private readonly webhookParser: WebhookParserService,
    private readonly messageRepo: MessageRepository,
  ) {
    this.verifyToken = env.WHATSAPP_VERIFY_TOKEN;
  }

  /**
   * GET /webhook — verificación del webhook por Meta.
   */
  verifyWebhookChallenge = (req: Request, res: Response): void => {
    const mode = req.query['hub.mode'] as string | undefined;
    const token = req.query['hub.verify_token'] as string | undefined;
    const challenge = req.query['hub.challenge'] as string | undefined;

    if (mode === 'subscribe' && token === this.verifyToken) {
      console.log('[WebhookController] Verificación de webhook exitosa');
      res.status(200).send(challenge);
      return;
    }

    console.warn('[WebhookController] Verificación fallida — token inválido o modo incorrecto');
    res.status(403).send('Forbidden');
  };

  /**
   * POST /webhook — recibe mensajes y eventos entrantes de WhatsApp.
   */
  receiveWebhookMessage = (req: Request, res: Response): void => {
    const correlationId = res.locals.correlationId ?? 'unknown';
    const payload = req.body as WaWebhookPayload | undefined;

    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    if (!this.webhookParser.isWhatsAppPayload(payload)) {
      res.status(200).json({ status: 'ignored' });
      return;
    }

    // Procesar de forma asíncrona — no bloquear respuesta a Meta
    this.processAsync(payload, correlationId, req.ip).catch((err: unknown) => {
      console.error('[WebhookController] Error en processAsync:', err);
    });

    // Meta requiere 200 OK en menos de 5 segundos
    res.status(200).json({ status: 'ok' });
  };

  private async processAsync(
    payload: WaWebhookPayload,
    correlationId: string,
    ip?: string,
  ): Promise<void> {
    // Log de webhook para auditoría
    await this.prisma.webhookEventLog.create({
      data: {
        correlationId,
        rawPayload: payload as object,
        ipAddress: ip,
        processedOk: true,
      },
    });

    const parsed = this.webhookParser.parse(payload);

    // Persistir y encolar mensajes inbound
    for (const msg of parsed.messages) {
      const inboxEvent = await this.prisma.inboxEvent.upsert({
        where: { wamid: msg.wamid },
        update: {}, // si ya existe (replay), no actualizar
        create: {
          wamid: msg.wamid,
          phone: msg.phone,
          payload: msg as object,
          idempotencyKey: msg.wamid,
        },
      });

      if (inboxEvent.status === 'pending') {
        await this.inboxProcessor.enqueue(msg, inboxEvent.id);
      }
    }

    // Persistir status de entrega
    for (const status of parsed.statuses) {
      try {
        await this.messageRepo.upsertStatus({
          wamid: status.wamid,
          messageId: status.wamid, // upsertStatus busca por wamid internamente
          status: status.status,
          timestamp: new Date(parseInt(status.timestamp, 10) * 1000),
          errorCode: status.errorCode,
          errorTitle: status.errorTitle,
        });
      } catch (err: unknown) {
        console.warn('[WebhookController] Error guardando status:', err);
      }
    }
  }
}
