/**
 * Event Bus interno — implementación liviana usando Node.js EventEmitter.
 * Permite desacoplar componentes sin dependencia externa.
 *
 * Eventos principales:
 * - message.received     → nuevo mensaje inbound persistido
 * - message.status       → status de entrega (sent/delivered/read/failed)
 * - conversation.handover → cambio de estado BOT→HUMAN o viceversa
 * - outbox.enqueued      → nuevo evento outbound encolado
 */
import { EventEmitter } from 'events';
import { ConversationFlowState, WaInboundMessage, WaStatus } from '../../types/whatsapp.types';

// ─── Tipos de eventos ─────────────────────────────────────────────────────────

export interface MessageReceivedEvent {
  wamid: string;
  phone: string;
  conversationId: string;
  citizenId: string;
  message: WaInboundMessage;
  correlationId: string;
}

export interface MessageStatusEvent {
  wamid: string;
  status: WaStatus['status'];
  phone: string;
  errorCode?: number;
  errorTitle?: string;
}

export interface ConversationHandoverEvent {
  conversationId: string;
  fromState: ConversationFlowState;
  toState: ConversationFlowState;
  triggeredBy: 'bot' | 'user' | 'agent' | 'system';
  agentId?: string;
  departmentSlug?: string;
  correlationId?: string;
}

export interface OutboxEnqueuedEvent {
  outboxId: string;
  phone: string;
  correlationId: string;
}

// ─── Tipos del mapa de eventos ────────────────────────────────────────────────

export type EventMap = {
  'message.received': MessageReceivedEvent;
  'message.status': MessageStatusEvent;
  'conversation.handover': ConversationHandoverEvent;
  'outbox.enqueued': OutboxEnqueuedEvent;
};

// ─── EventBusService ─────────────────────────────────────────────────────────

export class EventBusService extends EventEmitter {
  /** Emitir un evento tipado */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): boolean {
    return super.emit(event, payload);
  }

  /** Suscribirse a un evento tipado */
  on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): this {
    return super.on(event, listener);
  }

  /** Suscripción de un solo uso */
  once<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): this {
    return super.once(event, listener);
  }

  /** Desuscribirse */
  off<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): this {
    return super.off(event, listener);
  }
}

/** Singleton del bus de eventos */
export const eventBus = new EventBusService();
// Aumentar límite para evitar warnings en producción con muchos listeners
eventBus.setMaxListeners(50);
