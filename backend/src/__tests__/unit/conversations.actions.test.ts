import { ConversationsService } from '../../services/conversations.service';

describe('ConversationsService — acciones', () => {
  const conversationId = 'conv-1';
  const agentId = 'agent-1';

  it('assign desde BOT_FLOW debe llamar stateMachine.transition y crear assignment', async () => {
    const mockCtx = { id: conversationId, meta: { flowState: 'BOT_FLOW', version: 1 } };

    const conversationRepo: any = {
      getConversationContext: jest.fn().mockResolvedValue(mockCtx),
    };

    const stateMachine: any = {
      isValidTransition: jest.fn().mockReturnValue(true),
      transition: jest.fn().mockResolvedValue(undefined),
    };

    const prisma: any = {
      $transaction: jest.fn(async (fn: any) => {
        // Ejecuta la transacción simulada
        await fn({
          assignment: { updateMany: jest.fn(), create: jest.fn() },
          conversation: { update: jest.fn() },
          conversationMeta: { updateMany: jest.fn() },
        });
      }),
    };

    const svc = new ConversationsService(
      prisma as any,
      conversationRepo as any,
      stateMachine as any,
    );

    const res = await svc.assign(conversationId, agentId, 'dept-a');

    expect(conversationRepo.getConversationContext).toHaveBeenCalledWith(conversationId);
    expect(stateMachine.isValidTransition).toHaveBeenCalled();
    expect(stateMachine.transition).toHaveBeenCalledWith(
      conversationId,
      'HUMAN_FLOW',
      1,
      expect.any(Object),
    );
    expect(res).toEqual({ assigned: true, conversationId, agentId });
  });

  it('close debe fallar si la transición es inválida', async () => {
    const mockCtx = { id: conversationId, meta: { flowState: 'CLOSED', version: 5 } };
    const conversationRepo: any = { getConversationContext: jest.fn().mockResolvedValue(mockCtx) };
    const stateMachine: any = {
      isValidTransition: jest.fn().mockReturnValue(false),
      transition: jest.fn(),
    };
    const prisma: any = { conversation: { update: jest.fn() } };

    const svc = new ConversationsService(
      prisma as any,
      conversationRepo as any,
      stateMachine as any,
    );

    await expect(svc.close(conversationId, 'actor-1')).rejects.toThrow();
  });
});
