import { MessageType } from '@prisma/client';
import * as crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import type { AuditService } from '../services/audit.service';
import { ConversationsService } from '../services/conversations.service';
import { MessageService } from '../services/message.service';

const IdParam = z.object({ id: z.string().uuid() });
const AssignBody = z.object({
  userId: z.string().uuid().optional(),
  departmentSlug: z.string().optional(),
});
const TransferBody = z.object({
  toUserId: z.string().uuid(),
  departmentSlug: z.string().optional(),
});
const SendMessageBody = z.object({
  body: z.string().min(1).max(4096),
  messageType: z.nativeEnum(MessageType).optional(),
});

export class ConversationsController {
  constructor(
    private readonly service: ConversationsService,
    private readonly audit: AuditService,
    private readonly messageService: MessageService,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const result = await this.service.list({ cursor, limit });

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'conversation.list',
        targetType: 'Conversation',
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = IdParam.parse(req.params);
      const conv = await this.service.getById(id);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'conversation.get',
        targetType: 'Conversation',
        targetId: id,
      });

      res.json({ conversation: conv });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  assign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = IdParam.parse(req.params);
      const data = AssignBody.parse(req.body);
      const agentId = data.userId ?? req.user?.id;
      if (!agentId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const result = await this.service.assign(id, agentId, data.departmentSlug);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'conversation.assign',
        targetType: 'Conversation',
        targetId: id,
        metadata: { agentId, departmentSlug: data.departmentSlug },
      });

      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  transfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = IdParam.parse(req.params);
      const data = TransferBody.parse(req.body);

      const result = await this.service.transfer(id, data.toUserId, data.departmentSlug);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'conversation.transfer',
        targetType: 'Conversation',
        targetId: id,
        metadata: { toUserId: data.toUserId, departmentSlug: data.departmentSlug },
      });

      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  handover = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = IdParam.parse(req.params);
      const agentId = req.user?.id;
      if (!agentId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const result = await this.service.handover(id, agentId);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'conversation.handover',
        targetType: 'Conversation',
        targetId: id,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  close = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = IdParam.parse(req.params);
      const result = await this.service.close(id, req.user?.id);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'conversation.close',
        targetType: 'Conversation',
        targetId: id,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  reopen = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = IdParam.parse(req.params);
      const result = await this.service.reopen(id, req.user?.id);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'conversation.reopen',
        targetType: 'Conversation',
        targetId: id,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /conversations/:id/messages
   * Lista mensajes de una conversación (cursor-based pagination).
   */
  getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = IdParam.parse(req.params);
      const { cursor, limit } = req.pagination;

      const result = await this.messageService.listByConversation({
        conversationId: id,
        cursor,
        limit,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  /**
   * POST /conversations/:id/messages
   * Envía un mensaje outbound desde el dashboard.
   * Soporta Idempotency-Key en header para replay-safe retries.
   */
  postMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = IdParam.parse(req.params);
      const senderId = req.user?.id;
      if (!senderId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const idempotencyKey =
        typeof req.headers['idempotency-key'] === 'string'
          ? req.headers['idempotency-key']
          : crypto.randomUUID();

      const data = SendMessageBody.parse(req.body);

      const { message, isReplay } = await this.messageService.sendMessage({
        conversationId: id,
        body: data.body,
        messageType: data.messageType ?? MessageType.text,
        senderId,
        idempotencyKey,
      });

      res.status(isReplay ? 200 : 202).json({ message, idempotencyKey });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };
}
