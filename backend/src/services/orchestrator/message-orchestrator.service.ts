/**
 * MessageOrchestratorService — Orquesta el procesamiento de mensajes inbound.
 *
 * Flujo:
 * 1. Ciudadano: find or create
 * 2. Conversación: find or create + obtener estado actual
 * 3. Según flowState → delegar a Bot o Agente
 * 4. Persistir mensaje inbound
 * 5. Emitir evento message.received
 */
import { MessageDirection, MessageType } from '@prisma/client';
import { BOT_ACTIVE_STATES } from '../../config/conversation-states';
import { ConversationFlowState, WaInboundMessage } from '../../types/whatsapp.types';
import { extractMessageText } from '../../utils/wa-message-parser';
import { BotFsmState, BotService } from '../bot.service';
import { eventBus } from '../events/event-bus.service';
import { CitizenRepository } from '../repositories/citizen.repository';
import { ConversationRepository } from '../repositories/conversation.repository';
import { MessageRepository } from '../repositories/message.repository';
import { WhatsAppProvider } from '../whatsapp/whatsapp.provider';
import { ConversationStateMachine } from './conversation-state-machine';
import { DepartmentRouterStrategy } from './department-router.strategy';

function log(
  level: 'info' | 'warn' | 'error' | 'debug',
  event: string,
  correlationId: string,
  data?: Record<string, unknown>,
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'Orchestrator',
    event,
    correlationId,
    ...data,
  };
  // eslint-disable-next-line no-console
  console[level](JSON.stringify(entry));
}

export class MessageOrchestratorService {
  constructor(
    private readonly citizenRepo: CitizenRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly stateMachine: ConversationStateMachine,
    private readonly deptRouter: DepartmentRouterStrategy,
    private readonly botService: BotService,
    private readonly whatsappProvider: WhatsAppProvider,
    private readonly correlationId: string = '',
  ) {}

  /**
   * Punto de entrada para un mensaje inbound ya parseado.
   */
  async handleInboundMessage(
    phone: string,
    message: WaInboundMessage,
    profileName?: string,
  ): Promise<void> {
    // 1. Ciudadano
    const citizen = await this.citizenRepo.findOrCreate(phone, profileName);

    // 2. Conversación + meta
    const conversation = await this.conversationRepo.findOrCreateOpen(citizen.id);
    const ctx = await this.conversationRepo.getConversationContext(conversation.id);

    if (!ctx?.meta) {
      throw new Error(`Conversación sin meta para ciudadano ${citizen.id}`);
    }

    const flowState = ctx.meta.flowState as ConversationFlowState;
    const version = ctx.meta.version;

    // 3. Delegar según estado
    if (BOT_ACTIVE_STATES.includes(flowState)) {
      await this.handleBotFlow(phone, message, conversation.id, citizen.id, flowState, version);
    } else if (flowState === 'DEPARTMENT_ROUTING') {
      await this.handleDepartmentRouting(
        message,
        conversation.id,
        citizen.id,
        version,
        citizen.interests ?? [],
      );
    }
    // HUMAN_FLOW / ESCALATED → el agente responde desde el dashboard (no acción aquí)

    // 4. Persistir mensaje inbound
    const text = extractMessageText(message) ?? `[${message.type}]`;
    await this.messageRepo.create({
      conversationId: conversation.id,
      body: text,
      direction: MessageDirection.inbound,
      messageType: this.mapMessageType(message.type),
      externalMessageId: message.id,
      meta: { type: message.type, rawId: message.id },
    });

    // 5. Marcar como leído en WhatsApp
    this.whatsappProvider.markAsRead(message.id).catch((err: unknown) => {
      log('warn', 'orchestrator.mark_read.failed', this.correlationId, { error: String(err) });
    });

    // 6. Emitir evento
    eventBus.emit('message.received', {
      wamid: message.id,
      phone,
      conversationId: conversation.id,
      citizenId: citizen.id,
      message,
      correlationId: this.correlationId,
    });
  }

  private async handleBotFlow(
    phone: string,
    message: WaInboundMessage,
    conversationId: string,
    _citizenId: string,
    flowState: ConversationFlowState,
    version: number,
  ): Promise<void> {
    let currentFlowState = flowState;
    let currentVersion = version;

    // Si la conversación acaba de crearse en BOT_FLOW, transicionar a REGISTERING
    // antes de delegar al bot para que el orquestador refleje el estado correcto.
    if (flowState === 'BOT_FLOW') {
      try {
        await this.stateMachine.transition(conversationId, 'REGISTERING', version, {
          triggeredBy: 'bot',
        });
        currentFlowState = 'REGISTERING';
        currentVersion = version + 1;
      } catch (err) {
        // Si la transición falla (ej: ya estaba en REGISTERING por concurrencia), continuar
        log('warn', 'orchestrator.transition.bot_flow_to_registering.failed', this.correlationId, { error: String(err) });
      }
    }

    // Non-text durante registro: enviar fallback directamente
    const text = extractMessageText(message);
    if (!text) {
      await this.botService.handleNonTextMessage(phone, message.id, this.correlationId);
      return;
    }

    await this.botService.handleMessage(phone, text, message.id, this.correlationId);

    // Si el bot completó el registro, hacer handover a HUMAN_FLOW via DEPARTMENT_ROUTING
    const session = await this.botService.getSession(phone);
    if (session.state === BotFsmState.COMPLETED && currentFlowState === 'REGISTERING') {
      try {
        await this.stateMachine.transition(conversationId, 'DEPARTMENT_ROUTING', currentVersion, {
          triggeredBy: 'bot',
        });

        // Emitir evento de handover al dashboard
        eventBus.emit('conversation.handover', {
          conversationId,
          fromState: 'REGISTERING',
          toState: 'DEPARTMENT_ROUTING',
          triggeredBy: 'bot',
          correlationId: this.correlationId,
        });
      } catch (err) {
        log('warn', 'orchestrator.transition.registering_to_department_routing.failed', this.correlationId, { error: String(err) });
      }
    }
  }

  private async handleDepartmentRouting(
    message: WaInboundMessage,
    conversationId: string,
    _citizenId: string,
    version: number,
    interests: string[],
  ): Promise<void> {
    const deptSlug = await this.deptRouter.route({
      message,
      citizenId: _citizenId,
      conversationId,
      citizenInterests: interests,
    });

    await this.stateMachine.transition(conversationId, 'HUMAN_FLOW', version, {
      triggeredBy: 'system',
      departmentSlug: deptSlug,
    });
  }

  private mapMessageType(type: string): MessageType {
    const map: Record<string, MessageType> = {
      text: MessageType.text,
      image: MessageType.image,
      audio: MessageType.audio,
      video: MessageType.video,
      document: MessageType.document,
      location: MessageType.location,
      template: MessageType.template,
      interactive: MessageType.interactive,
    };
    return map[type] ?? MessageType.system;
  }
}
