/**
 * Estados de la máquina de estados de conversación y transiciones válidas.
 */
import { ConversationFlowState } from '../types/whatsapp.types';

/** Transiciones válidas entre estados */
export const VALID_TRANSITIONS: Record<ConversationFlowState, ConversationFlowState[]> = {
  BOT_FLOW: ['REGISTERING', 'DEPARTMENT_ROUTING', 'HUMAN_FLOW', 'ESCALATED', 'CLOSED'],
  REGISTERING: ['BOT_FLOW', 'DEPARTMENT_ROUTING', 'CLOSED'],
  DEPARTMENT_ROUTING: ['HUMAN_FLOW', 'BOT_FLOW', 'ESCALATED', 'CLOSED'],
  HUMAN_FLOW: ['BOT_FLOW', 'ESCALATED', 'CLOSED'],
  ESCALATED: ['HUMAN_FLOW', 'CLOSED'],
  CLOSED: ['BOT_FLOW'], // re-abrir
};

/** Descripción legible de cada estado */
export const STATE_LABELS: Record<ConversationFlowState, string> = {
  BOT_FLOW: 'Atendido por bot',
  REGISTERING: 'Registrando ciudadano',
  DEPARTMENT_ROUTING: 'Enrutando a departamento',
  HUMAN_FLOW: 'Atendido por agente',
  ESCALATED: 'Escalado',
  CLOSED: 'Cerrado',
};

/** Estados que permiten que el bot envíe mensajes */
export const BOT_ACTIVE_STATES: ConversationFlowState[] = ['BOT_FLOW', 'REGISTERING'];

/** Estados que requieren agente humano */
export const HUMAN_ACTIVE_STATES: ConversationFlowState[] = ['HUMAN_FLOW', 'ESCALATED'];
