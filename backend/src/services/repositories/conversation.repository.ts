/**
 * Repository para Conversation + ConversationMeta.
 * Encapsula toda la lógica de acceso a datos de conversaciones.
 */
import { ConversationStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ConversationFlowState } from '../../types/whatsapp.types';
import { PrismaService } from '../prisma.service';

type ConversationContext = Prisma.ConversationGetPayload<{
  include: {
    meta: true;
    citizen: {
      select: {
        id: true;
        phone: true;
        name: true;
        leadStatus: true;
      };
    };
  };
}>;

export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca o crea una conversación OPEN para el ciudadano.
   * Si no existe, también crea su ConversationMeta con estado inicial BOT_FLOW.
   */
  async findOrCreateOpen(citizenId: string): Promise<{ id: string; status: string }> {
    const existing = await this.prisma.conversation.findFirst({
      where: { citizenId, status: ConversationStatus.open },
      include: { meta: true },
    });

    if (existing) {
      // Crear meta si no existe (migración de datos existentes)
      if (!existing.meta) {
        await this.prisma.conversationMeta.create({
          data: { conversationId: existing.id },
        });
      }
      return existing;
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        citizenId,
        status: ConversationStatus.open,
        meta: {
          create: { flowState: 'BOT_FLOW' },
        },
      },
    });

    return conversation;
  }

  /**
   * Actualiza el flowState con optimistic locking (version).
   * Lanza error si la version no coincide (concurrent update).
   */
  async updateFlowState(
    conversationId: string,
    newState: ConversationFlowState,
    expectedVersion: number,
    opts?: {
      lockedByUserId?: string | undefined;
      departmentSlug?: string | undefined;
    },
  ): Promise<void> {
    const updated = await this.prisma.conversationMeta.updateMany({
      where: { conversationId, version: expectedVersion },
      data: {
        flowState: newState,
        version: { increment: 1 },
        ...(opts?.lockedByUserId !== undefined ? { lockedByUserId: opts.lockedByUserId } : {}),
        ...(opts?.departmentSlug !== undefined ? { departmentSlug: opts.departmentSlug } : {}),
        ...(newState === 'HUMAN_FLOW' || newState === 'ESCALATED'
          ? { handoverAt: new Date() }
          : {}),
      },
    });

    if (updated.count === 0) {
      throw new Error(
        `Optimistic lock failed for conversation ${conversationId} at version ${expectedVersion}`,
      );
    }
  }

  /**
   * Lee el contexto completo de una conversación.
   */
  async getConversationContext(conversationId: string): Promise<ConversationContext | null> {
    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        meta: true,
        citizen: { select: { id: true, phone: true, name: true, leadStatus: true } },
      },
    });
  }

  /**
   * Cierra conversaciones inactivas (sin mensajes en N días).
   */
  async closeInactive(olderThanMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const result = await this.prisma.conversation.updateMany({
      where: {
        status: ConversationStatus.open,
        updatedAt: { lt: cutoff },
      },
      data: { status: ConversationStatus.closed },
    });
    return result.count;
  }
}
