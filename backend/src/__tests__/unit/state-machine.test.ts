/**
 * Unit tests: ConversationStateMachine — validación de transiciones
 * Cubre: transiciones válidas, transiciones inválidas, anti-loop, handover completo.
 */
import { VALID_TRANSITIONS } from '../../config/conversation-states';
import { ConversationFlowState } from '../../types/whatsapp.types';

describe('VALID_TRANSITIONS — transiciones de estado', () => {
  const validPairs: Array<[ConversationFlowState, ConversationFlowState]> = [
    ['BOT_FLOW', 'REGISTERING'],
    ['REGISTERING', 'DEPARTMENT_ROUTING'],
    ['DEPARTMENT_ROUTING', 'HUMAN_FLOW'],
    ['HUMAN_FLOW', 'CLOSED'],
    ['HUMAN_FLOW', 'ESCALATED'],
    ['ESCALATED', 'CLOSED'],
  ];

  test.each(validPairs)('debe permitir %s → %s', (from, to) => {
    expect(VALID_TRANSITIONS[from]?.includes(to)).toBe(true);
  });

  // Transiciones que definitivamente no deben estar permitidas
  const invalidPairs: Array<[ConversationFlowState, ConversationFlowState]> = [
    ['CLOSED', 'HUMAN_FLOW'],   // CLOSED solo puede ir a BOT_FLOW
    ['ESCALATED', 'BOT_FLOW'],  // ESCALATED puede ir a HUMAN_FLOW o CLOSED, no BOT_FLOW
    ['HUMAN_FLOW', 'HUMAN_FLOW'], // auto-transición
  ];

  test.each(invalidPairs)('debe rechazar %s → %s como inválido', (from, to) => {
    expect(VALID_TRANSITIONS[from]?.includes(to) ?? false).toBe(false);
  });

  it('HUMAN_FLOW no debe permitir auto-transición (anti-loop)', () => {
    expect(VALID_TRANSITIONS['HUMAN_FLOW']?.includes('HUMAN_FLOW') ?? false).toBe(false);
  });

  it('CLOSED solo puede transicionar a BOT_FLOW (re-abrir)', () => {
    expect(VALID_TRANSITIONS['CLOSED']).toEqual(['BOT_FLOW']);
  });
});

describe('ConversationStateMachine — isValidTransition', () => {
  // Importamos ConversationStateMachine con un mock de repo
  const mockRepo = {
    getConversationContext: jest.fn(),
    updateFlowState: jest.fn(),
    findOrCreateOpen: jest.fn(),
  };

  // Importar clase directamente
  const { ConversationStateMachine } = require('../../services/orchestrator/conversation-state-machine');
  const machine = new ConversationStateMachine(mockRepo);

  it('debe retornar true para transición BOT_FLOW → REGISTERING', () => {
    expect(machine.isValidTransition('BOT_FLOW', 'REGISTERING')).toBe(true);
  });

  it('debe retornar false para transición CLOSED → HUMAN_FLOW', () => {
    expect(machine.isValidTransition('CLOSED', 'HUMAN_FLOW')).toBe(false);
  });

  it('debe retornar false para transición de estado a sí mismo', () => {
    expect(machine.isValidTransition('HUMAN_FLOW', 'HUMAN_FLOW')).toBe(false);
  });
});
