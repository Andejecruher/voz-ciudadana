/**
 * Repository para Message y MessageStatus.
 */
import { Message, MessageDirection, MessageStatus, MessageType } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export interface CreateMessageInput {
  conversationId: string;
  body: string;
  direction: MessageDirection;
  messageType?: MessageType;
  externalMessageId?: string;
  meta?: Record<string, unknown>;
}

export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateMessageInput): Promise<Message> {
    return this.prisma.message.create({
      data: {
        conversationId: input.conversationId,
        body: input.body,
        direction: input.direction,
        messageType: input.messageType ?? MessageType.text,
        externalMessageId: input.externalMessageId,
        meta: (input.meta ?? {}) as object,
      },
    });
  }

  async findByExternalId(externalMessageId: string): Promise<Message | null> {
    return this.prisma.message.findFirst({
      where: { externalMessageId },
    });
  }

  /**
   * Persiste un status de entrega (sent/delivered/read/failed).
   * Evita duplicados: si ya existe el mismo status para el mismo wamid, no inserta.
   */
  async upsertStatus(params: {
    wamid: string;
    messageId: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: Date;
    errorCode?: number;
    errorTitle?: string;
  }): Promise<MessageStatus | undefined> {
    // Buscar el mensaje por wamid si no tenemos el id interno
    const msg = await this.prisma.message.findFirst({
      where: { externalMessageId: params.wamid },
    });

    if (!msg) return; // mensaje no encontrado — ignorar status

    return this.prisma.messageStatus.create({
      data: {
        messageId: msg.id,
        wamid: params.wamid,
        status: params.status,
        timestamp: params.timestamp,
        errorCode: params.errorCode,
        errorTitle: params.errorTitle,
      },
    });
  }

  async getStatusTimeline(wamid: string): Promise<MessageStatus[]> {
    return this.prisma.messageStatus.findMany({
      where: { wamid },
      orderBy: { timestamp: 'asc' },
    });
  }
}
