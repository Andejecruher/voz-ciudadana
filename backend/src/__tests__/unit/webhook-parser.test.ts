/**
 * Unit tests: WebhookParserService
 * Cubre: parsing de texto, detección de payload WA, payload vacío, replay wamid.
 */
import { WebhookParserService } from '../../services/whatsapp/webhook-parser.service';
import { WaWebhookPayload } from '../../types/whatsapp.types';

const parser = new WebhookParserService();

function buildPayload(overrides?: Partial<WaWebhookPayload>): WaWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'business-id',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '5219610000000', phone_number_id: 'phone-id' },
              messages: [
                {
                  type: 'text',
                  id: 'wamid-001',
                  from: '5219612345678',
                  timestamp: '1700000000',
                  text: { body: 'Hola mundo' },
                },
              ],
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('WebhookParserService.parse', () => {
  it('debe parsear un mensaje de texto correctamente', () => {
    const result = parser.parse(buildPayload());
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].wamid).toBe('wamid-001');
    expect(result.messages[0].phone).toBe('5219612345678');
  });

  it('debe retornar arreglo vacío para payload sin mensajes', () => {
    const result = parser.parse(buildPayload({ entry: [] }));
    expect(result.messages).toHaveLength(0);
  });

  it('debe preservar el wamid idéntico en replay (dedup es responsabilidad del worker)', () => {
    const result1 = parser.parse(buildPayload());
    const result2 = parser.parse(buildPayload());
    expect(result1.messages[0].wamid).toBe(result2.messages[0].wamid);
  });
});

describe('WebhookParserService.isWhatsAppPayload', () => {
  it('debe retornar true para payload WA válido', () => {
    expect(parser.isWhatsAppPayload(buildPayload())).toBe(true);
  });

  it('debe retornar false para objeto de otra plataforma', () => {
    expect(parser.isWhatsAppPayload(buildPayload({ object: 'instagram' }))).toBe(false);
  });

  it('debe retornar false para objeto nulo/undefined', () => {
    expect(parser.isWhatsAppPayload(null as unknown as WaWebhookPayload)).toBe(false);
  });
});
