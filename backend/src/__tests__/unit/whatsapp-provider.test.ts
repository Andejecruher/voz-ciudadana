/**
 * Tests unitarios para WhatsAppProvider — foco en privacidad de logs.
 *
 * Verifica que sendTextWithTemplateFallback no filtre el teléfono
 * en claro cuando registra el warning de ventana 24h.
 */

import { WhatsAppProvider } from '../../services/whatsapp/whatsapp.provider';

// ─── Mock de RedisService ────────────────────────────────────────────────────

function makeRedisMock() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  };
}

// ─── Mock de metaConfig ──────────────────────────────────────────────────────

jest.mock('../../config/meta.config', () => ({
  metaConfig: {
    messagesUrl: 'https://fake.meta.api/messages',
    accessToken: 'fake-token',
    appSecret: 'fake-secret',
    phoneNumberId: '123',
    verifyToken: 'vt',
  },
}));

// ─── Mock de generateAppSecretProof ─────────────────────────────────────────

jest.mock('../../utils/hmac-validator', () => ({
  generateAppSecretProof: jest.fn().mockReturnValue('fake-proof'),
}));

// ─── Mock de meta-error-parser ───────────────────────────────────────────────

jest.mock('../../utils/meta-error-parser', () => ({
  isMetaErrorResponse: jest.fn().mockReturnValue(false),
  isOutsideConversationWindow: jest.fn((code: number) => code === 131047),
  parseMetaError: jest.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('WhatsAppProvider — privacidad de logs', () => {
  const PHONE = '+521234567890';

  it('sendTextWithTemplateFallback: no debe filtrar phone en claro al loguear fuera de ventana 24h', async () => {
    const redis = makeRedisMock();
    // @ts-ignore — mock parcial
    const provider = new WhatsAppProvider(redis);

    // Spy sobre sendText para lanzar error de fuera de ventana
    const outsideWindowError = { code: 131047, message: 'Outside conversation window' };
    jest.spyOn(provider as any, 'sendText').mockRejectedValueOnce(outsideWindowError);
    jest.spyOn(provider as any, 'sendTemplate').mockResolvedValueOnce({ messages: [{ id: 'wamid.tmpl' }] });
    // checkRateLimit debe pasar sin bloquear
    jest.spyOn(provider as any, 'checkRateLimit').mockResolvedValue(undefined);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await provider.sendTextWithTemplateFallback(
      PHONE,
      'Hola ciudadano',
      { name: 'welcome_template', languageCode: 'es_MX' },
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = warnSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logged) as Record<string, unknown>;

    // Debe ser log estructurado con el evento correcto
    expect(parsed.event).toBe('whatsapp.outside_window');
    expect(parsed.service).toBe('WhatsAppProvider');

    // El phone NO debe aparecer en claro
    expect(logged).not.toContain(PHONE);
    // El campo to debe estar enmascarado
    expect(parsed.to).toMatch(/\*+/);

    warnSpy.mockRestore();
  });
});
