/**
 * HandoverController — Gestión de handover bot↔humano.
 *
 * Permite a los agentes del dashboard tomar o liberar una conversación.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { ConversationStateMachine } from '../services/orchestrator/conversation-state-machine';
import { ConversationRepository } from '../services/repositories/conversation.repository';
import { ConversationFlowState } from '../types/whatsapp.types';

const takeoverSchema = z.object({
  conversationId: z.string().uuid(),
});

export class HandoverController {
  constructor(
    private readonly stateMachine: ConversationStateMachine,
    private readonly conversationRepo: ConversationRepository,
  ) {}

  /**
   * POST /api/v1/handover/take
   * El agente toma control de una conversación (BOT → HUMAN_FLOW).
   */
  take = async (req: Request, res: Response): Promise<void> => {
    const parsed = takeoverSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Payload inválido' });
      return;
    }

    const { conversationId } = parsed.data;
    const agent = req.user;
    if (!agent?.id) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const ctx = await this.conversationRepo.getConversationContext(conversationId);
    if (!ctx?.meta) {
      res.status(404).json({ error: 'Conversación no encontrada' });
      return;
    }

    const currentState = ctx.meta.flowState as ConversationFlowState;
    if (currentState === 'HUMAN_FLOW' || currentState === 'ESCALATED') {
      res.status(409).json({ error: 'Conversación ya asignada a agente' });
      return;
    }

    try {
      await this.stateMachine.transition(conversationId, 'HUMAN_FLOW', ctx.meta.version, {
        triggeredBy: 'agent',
        agentId: agent.id,
      });
      res.status(200).json({ status: 'taken', conversationId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error interno';
      res.status(500).json({ error: message });
    }
  };

  /**
   * POST /api/v1/handover/release
   * El agente devuelve la conversación al bot (HUMAN_FLOW → BOT_FLOW).
   */
  release = async (req: Request, res: Response): Promise<void> => {
    const parsed = takeoverSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Payload inválido' });
      return;
    }

    const { conversationId } = parsed.data;
    const agent = req.user;

    const ctx = await this.conversationRepo.getConversationContext(conversationId);
    if (!ctx?.meta) {
      res.status(404).json({ error: 'Conversación no encontrada' });
      return;
    }

    try {
      await this.stateMachine.transition(conversationId, 'BOT_FLOW', ctx.meta.version, {
        triggeredBy: 'agent',
        agentId: agent?.id,
      });
      res.status(200).json({ status: 'released', conversationId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error interno';
      res.status(500).json({ error: message });
    }
  };

  /**
   * POST /api/v1/handover/escalate
   * Escala una conversación.
   */
  escalate = async (req: Request, res: Response): Promise<void> => {
    const parsed = takeoverSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Payload inválido' });
      return;
    }

    const { conversationId } = parsed.data;
    const agent = req.user;

    const ctx = await this.conversationRepo.getConversationContext(conversationId);
    if (!ctx?.meta) {
      res.status(404).json({ error: 'Conversación no encontrada' });
      return;
    }

    try {
      await this.stateMachine.transition(conversationId, 'ESCALATED', ctx.meta.version, {
        triggeredBy: 'agent',
        agentId: agent?.id,
      });
      res.status(200).json({ status: 'escalated', conversationId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error interno';
      res.status(500).json({ error: message });
    }
  };
}
