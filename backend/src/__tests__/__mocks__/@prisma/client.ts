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

export enum MessageStatusValue {
  sent = 'sent',
  delivered = 'delivered',
  read = 'read',
  failed = 'failed',
}

export enum ConversationStatus {
  open = 'open',
  in_progress = 'in_progress',
  resolved = 'resolved',
  closed = 'closed',
}

export const Prisma = {
  ConversationGetPayload: {},
  Decimal: class Decimal {
    constructor(public val: string | number) {}
    toString(): string {
      return String(this.val);
    }
  },
};

export enum EventStatus {
  draft = 'draft',
  published = 'published',
  completed = 'completed',
  cancelled = 'cancelled',
}

export enum EventType {
  townhall = 'townhall',
  community = 'community',
  volunteer = 'volunteer',
  campaign = 'campaign',
  rally = 'rally',
}

export enum RegistrationStatus {
  invited = 'invited',
  registered = 'registered',
  confirmed = 'confirmed',
  cancelled = 'cancelled',
  waitlist = 'waitlist',
}

export enum AttendanceStatus {
  pending = 'pending',
  attended = 'attended',
  no_show = 'no_show',
}
