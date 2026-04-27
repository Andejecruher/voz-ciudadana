/**
 * Conversation State Machine.
 *
 * Gestiona las transiciones de estado de una conversación:
 * BOT_FLOW → REGISTERING → DEPARTMENT_ROUTING → HUMAN_FLOW → ESCALATED → CLOSED
 *
 * Usa optimistic locking via ConversationRepository.updateFlowState.
 * Emite eventos en el EventBus para que otros componentes reaccionen.
 */
import { VALID_TRANSITIONS } from '../../config/conversation-states';
import { ConversationFlowState } from '../../types/whatsapp.types';
import { eventBus } from '../events/event-bus.service';
import { ConversationRepository } from '../repositories/conversation.repository';

export class ConversationStateMachine {
  constructor(private readonly conversationRepo: ConversationRepository) {}

  /**
   * Transiciona el estado de una conversación con validación y optimistic locking.
   *
   * @param conversationId  - UUID de la conversación
   * @param toState         - Estado destino
   * @param currentVersion  - Versión actual para optimistic locking
   * @param opts            - Opciones adicionales (agente, departamento)
   */
  async transition(
    conversationId: string,
    toState: ConversationFlowState,
    currentVersion: number,
    opts?: {
      triggeredBy?: 'bot' | 'user' | 'agent' | 'system';
      agentId?: string;
      departmentSlug?: string;
    },
  ): Promise<void> {
    const ctx = await this.conversationRepo.getConversationContext(conversationId);
    if (!ctx?.meta) {
      throw new Error(`Conversación ${conversationId} no encontrada o sin meta`);
    }

    const fromState = ctx.meta.flowState as ConversationFlowState;

    // Validar transición
    if (!this.isValidTransition(fromState, toState)) {
      throw new Error(
        `Transición inválida: ${fromState} → ${toState} para conversación ${conversationId}`,
      );
    }

    // Anti-loop: prevenir transiciones cíclicas rápidas BOT↔HUMAN
    if (fromState === toState) {
      console.warn(`[StateMachine] Transición ${fromState} → ${toState} es idempotente, ignorando`);
      return;
    }

    // Aplicar con optimistic locking
    await this.conversationRepo.updateFlowState(conversationId, toState, currentVersion, {
      lockedByUserId: opts?.agentId,
      departmentSlug: opts?.departmentSlug,
    });

    // Emitir evento de handover
    if (
      (fromState === 'BOT_FLOW' || fromState === 'REGISTERING') &&
      (toState === 'HUMAN_FLOW' || toState === 'ESCALATED')
    ) {
      eventBus.emit('conversation.handover', {
        conversationId,
        fromState,
        toState,
        triggeredBy: opts?.triggeredBy ?? 'system',
        agentId: opts?.agentId,
        departmentSlug: opts?.departmentSlug,
      });
    }

    console.log(`[StateMachine] ${conversationId}: ${fromState} → ${toState}`);
  }

  /** Verifica si una transición es válida */
  isValidTransition(from: ConversationFlowState, to: ConversationFlowState): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }
}
