/**
 * Mock de @prisma/client para tests unitarios.
 * Exporta las enums reales y stubs de los tipos generados.
 */

export enum LeadStatus {
  new = 'new',
  contacted = 'contacted',
  converted = 'converted',
  lost = 'lost',
}

export enum SourceChannel {
  whatsapp = 'whatsapp',
  web = 'web',
  phone = 'phone',
}

export enum MessageDirection {
  inbound = 'inbound',
  outbound = 'outbound',
}

export enum MessageType {
  text = 'text',
  image = 'image',
  audio = 'audio',
  video = 'video',
  document = 'document',
  location = 'location',
  template = 'template',
  interactive = 'interactive',
  system = 'system',
}

export enum ConversationStatus {
  open = 'open',
  closed = 'closed',
  pending = 'pending',
}

export const Prisma = {
  ConversationGetPayload: {},
};
