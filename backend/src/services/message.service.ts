/**
 * MessageService — lógica de negocio para el recurso Message.
 *
 * Responsabilidades:
 *  - Listar mensajes de una conversación (cursor-based pagination)
 *  - Enviar mensaje outbound desde el dashboard con idempotencia Redis
 *  - Adjuntar un Attachment a un mensaje existente
 *
 * Append-only: no expone operaciones de update ni delete.
 */
import { Attachment, Message, MessageDirection, MessageType } from '@prisma/client';
import { QUEUE_CONFIG, REDIS_KEYS } from '../config/messaging.constants';
import { WaTextOutbound } from '../types/whatsapp.types';
import { AppError } from '../utils/app-error';
import { OutboxProcessorService } from './events/outbox-processor.service';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { type MessageWithStatuses, MessageRepository } from './repositories/message.repository';

export type MessageListResult = {
  items: MessageWithStatuses[];
  meta: { nextCursor: string | undefined; hasNextPage: boolean };
};

export type SendMessageResult = {
  message: Message;
  /** true cuando la respuesta es fruto de un replay (mismo Idempotency-Key) */
  isReplay: boolean;
};

export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageRepo: MessageRepository,
    private readonly outboxProcessor: OutboxProcessorService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Devuelve los mensajes de una conversación en orden cronológico ascendente,
   * incluyendo statuses de entrega y attachments.
   */
  async listByConversation(params: {
    conversationId: string;
    cursor?: string;
    limit: number;
  }): Promise<MessageListResult> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: params.conversationId },
    });
    if (!conv) throw AppError.notFound('Conversación no encontrada');

    const { items, hasNextPage } = await this.messageRepo.listByConversation(params);

    return {
      items,
      meta: {
        nextCursor: hasNextPage ? items[items.length - 1]?.id : undefined,
        hasNextPage,
      },
    };
  }

  /**
   * Persiste un mensaje outbound y lo encola en WhatsApp.
   * Si el mismo Idempotency-Key ya fue procesado, devuelve el mensaje original (isReplay: true).
   */
  async sendMessage(params: {
    conversationId: string;
    body: string;
    messageType: MessageType;
    senderId: string;
    idempotencyKey: string;
  }): Promise<SendMessageResult> {
    // Idempotency check — evita duplicados en retries del cliente
    const cachedId = await this.redis.get(REDIS_KEYS.MSG_IDEMPOTENCY(params.idempotencyKey));
    if (cachedId) {
      const existing = await this.prisma.message.findUnique({ where: { id: cachedId } });
      if (existing) return { message: existing, isReplay: true };
    }

    // Cargar conversación con el teléfono del ciudadano (necesario para envío WA)
    const conv = await this.prisma.conversation.findUnique({
      where: { id: params.conversationId },
      include: { citizen: { select: { phone: true } } },
    });
    if (!conv) throw AppError.notFound('Conversación no encontrada');

    // Persistir registro de mensaje (append-only — no update/delete)
    const message = await this.messageRepo.create({
      conversationId: params.conversationId,
      body: params.body,
      direction: MessageDirection.outbound,
      messageType: params.messageType,
      meta: { senderId: params.senderId },
    });

    // Encolar entrega outbound vía WhatsApp
    const waPayload: WaTextOutbound = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: conv.citizen.phone,
      type: 'text',
      text: { body: params.body },
    };

    await this.outboxProcessor.enqueue(
      conv.citizen.phone,
      waPayload,
      params.idempotencyKey,
      params.conversationId,
    );

    // Guardar idempotency key → message ID en Redis (TTL 24h)
    await this.redis.set(
      REDIS_KEYS.MSG_IDEMPOTENCY(params.idempotencyKey),
      message.id,
      QUEUE_CONFIG.WAMID_DEDUPE_TTL_SECONDS,
    );

    return { message, isReplay: false };
  }

  /**
   * Crea un Attachment y lo vincula al mensaje indicado.
   * La subida del archivo al storage es responsabilidad del cliente —
   * este método solo persiste los metadatos y el storageKey resultante.
   */
  async addAttachment(params: {
    messageId: string;
    storageKey: string;
    mimeType: string;
    fileSizeBytes: bigint;
    originalFilename?: string;
    cdnUrl?: string;
    uploadedBy: string;
  }): Promise<Attachment> {
    const msg = await this.prisma.message.findUnique({ where: { id: params.messageId } });
    if (!msg) throw AppError.notFound('Mensaje no encontrado');

    return this.prisma.attachment.create({
      data: {
        messageId: params.messageId,
        storageKey: params.storageKey,
        mimeType: params.mimeType,
        fileSizeBytes: params.fileSizeBytes,
        originalFilename: params.originalFilename,
        cdnUrl: params.cdnUrl,
        uploadedBy: params.uploadedBy,
      },
    });
  }
}
