import { ConversationFlowState } from '../types/whatsapp.types';
import { AppError } from '../utils/app-error';
import { ConversationStateMachine } from './orchestrator/conversation-state-machine';
import { PrismaService } from './prisma.service';
import { ConversationRepository } from './repositories/conversation.repository';

export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationRepo: ConversationRepository,
    private readonly stateMachine: ConversationStateMachine,
  ) {}

  async list(params: { cursor?: string; limit?: number } = { limit: 20 }) {
    const limit = params.limit ?? 20;
    const rows = await this.prisma.conversation.findMany({
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: { meta: true, citizen: { select: { id: true, phone: true, name: true } } },
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;

    return {
      items,
      meta: { nextCursor: hasNextPage ? items[items.length - 1]?.id : undefined, hasNextPage },
    };
  }

  async getById(id: string) {
    const ctx = await this.conversationRepo.getConversationContext(id);
    if (!ctx) throw AppError.notFound('Conversación no encontrada');
    return ctx;
  }

  /** Asigna una conversación a un agente. Si la conversación está en BOT_FLOW, hace handover a HUMAN_FLOW. */
  async assign(conversationId: string, agentId: string, departmentSlug?: string) {
    const ctx = await this.conversationRepo.getConversationContext(conversationId);
    if (!ctx?.meta) throw AppError.notFound('Conversación no encontrada');

    const currentState = ctx.meta.flowState as ConversationFlowState;

    // Si está en BOT_FLOW o REGISTERING, realizar handover hacia HUMAN_FLOW
    if (
      currentState === 'BOT_FLOW' ||
      currentState === 'REGISTERING' ||
      currentState === 'DEPARTMENT_ROUTING'
    ) {
      // Validación de transición
      if (!this.stateMachine.isValidTransition(currentState, 'HUMAN_FLOW')) {
        throw AppError.conflict(`Transición inválida: ${currentState} → HUMAN_FLOW`);
      }

      await this.stateMachine.transition(conversationId, 'HUMAN_FLOW', ctx.meta.version, {
        triggeredBy: 'agent',
        agentId,
        departmentSlug,
      });
    }

    // Crear assignment y actualizar conversación en transacción
    await this.prisma.$transaction(async (tx) => {
      await tx.assignment.updateMany({
        where: { conversationId, isActive: true },
        data: { isActive: false, releasedAt: new Date() },
      });

      await tx.assignment.create({
        data: { conversationId, userId: agentId, departmentSlug },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { assignedUserId: agentId, assignedDept: departmentSlug ?? null },
      });

      await tx.conversationMeta.updateMany({
        where: { conversationId },
        data: { lockedByUserId: agentId, lockedAt: new Date() },
      });
    });

    return { assigned: true, conversationId, agentId };
  }

  /** Transfiere la conversación a otro agente sin forzar cambio de estado. */
  async transfer(
    conversationId: string,
    toUserId: string,
    performedBy?: string,
    departmentSlug?: string,
  ) {
    const ctx = await this.conversationRepo.getConversationContext(conversationId);
    if (!ctx?.meta) throw AppError.notFound('Conversación no encontrada');

    if (ctx.meta.flowState === 'CLOSED')
      throw AppError.conflict('No se puede transferir una conversación cerrada');

    await this.prisma.$transaction(async (tx) => {
      await tx.assignment.updateMany({
        where: { conversationId, isActive: true },
        data: { isActive: false, releasedAt: new Date() },
      });

      await tx.assignment.create({ data: { conversationId, userId: toUserId, departmentSlug } });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { assignedUserId: toUserId, assignedDept: departmentSlug ?? null },
      });

      await tx.conversationMeta.updateMany({
        where: { conversationId },
        data: { lockedByUserId: toUserId },
      });
    });

    return { transferred: true, conversationId, toUserId };
  }

  /** Handover explícito: fuerza la transición a HUMAN_FLOW y crea assignment. */
  async handover(conversationId: string, agentId: string, departmentSlug?: string) {
    const ctx = await this.conversationRepo.getConversationContext(conversationId);
    if (!ctx?.meta) throw AppError.notFound('Conversación no encontrada');

    const from = ctx.meta.flowState as ConversationFlowState;
    if (!this.stateMachine.isValidTransition(from, 'HUMAN_FLOW'))
      throw AppError.conflict('Transición inválida');

    await this.stateMachine.transition(conversationId, 'HUMAN_FLOW', ctx.meta.version, {
      triggeredBy: 'agent',
      agentId,
      departmentSlug,
    });

    // Luego asignar
    await this.prisma.$transaction(async (tx) => {
      await tx.assignment.updateMany({
        where: { conversationId, isActive: true },
        data: { isActive: false, releasedAt: new Date() },
      });
      await tx.assignment.create({ data: { conversationId, userId: agentId, departmentSlug } });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { assignedUserId: agentId, assignedDept: departmentSlug ?? null },
      });
    });

    return { handover: true, conversationId, agentId };
  }

  async close(conversationId: string, performedBy?: string) {
    const ctx = await this.conversationRepo.getConversationContext(conversationId);
    if (!ctx?.meta) throw AppError.notFound('Conversación no encontrada');

    const from = ctx.meta.flowState as ConversationFlowState;
    if (!this.stateMachine.isValidTransition(from, 'CLOSED'))
      throw AppError.conflict('Transición inválida a CLOSED');

    await this.stateMachine.transition(conversationId, 'CLOSED', ctx.meta.version, {
      triggeredBy: 'agent',
      agentId: performedBy,
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'closed' as any },
    });

    return { closed: true, conversationId };
  }

  async reopen(conversationId: string, performedBy?: string) {
    const ctx = await this.conversationRepo.getConversationContext(conversationId);
    if (!ctx?.meta) throw AppError.notFound('Conversación no encontrada');

    const from = ctx.meta.flowState as ConversationFlowState;
    if (!this.stateMachine.isValidTransition(from, 'BOT_FLOW'))
      throw AppError.conflict('Transición inválida a BOT_FLOW');

    await this.stateMachine.transition(conversationId, 'BOT_FLOW', ctx.meta.version, {
      triggeredBy: 'agent',
      agentId: performedBy,
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'open' as any },
    });

    return { reopened: true, conversationId };
  }
}
