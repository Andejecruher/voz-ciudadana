/**
 * TemplateService — Gestión de templates de WhatsApp.
 * Envío con fallback automático para ventana de 24h cerrada.
 */
import { WaSendMessageResponse, WaTemplateOutbound } from '../../types/whatsapp.types';
import { WhatsAppProvider } from './whatsapp.provider';

export interface TemplateParams {
  name: string;
  languageCode: string;
  components?: WaTemplateOutbound['template']['components'];
}

export class TemplateService {
  constructor(private readonly provider: WhatsAppProvider) {}

  async send(to: string, template: TemplateParams): Promise<WaSendMessageResponse> {
    return this.provider.sendTemplate(
      to,
      template.name,
      template.languageCode,
      template.components,
    );
  }

  /**
   * Envía texto; si la ventana de 24h está cerrada, usa el template de re-engagement.
   */
  async sendWithReEngagementFallback(
    to: string,
    textBody: string,
    reEngagementTemplate: TemplateParams,
  ): Promise<WaSendMessageResponse> {
    return this.provider.sendTextWithTemplateFallback(to, textBody, {
      name: reEngagementTemplate.name,
      languageCode: reEngagementTemplate.languageCode,
    });
  }
}
