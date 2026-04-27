/**
 * MediaService — Gestión de media: upload, download, URLs CDN.
 */
import { PrismaService } from '../prisma.service';
import { WhatsAppProvider } from './whatsapp.provider';

export interface UploadedMedia {
  mediaId: string; // ID en Meta
  mimeType: string;
  originalFilename: string;
  fileSizeBytes: number;
}

export class MediaService {
  constructor(
    private readonly provider: WhatsAppProvider,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Sube un archivo a la Media API de Meta y lo persiste en Attachment.
   */
  async upload(
    fileBuffer: Buffer,
    mimeType: string,
    filename: string,
    citizenId?: string,
    messageId?: string,
  ): Promise<UploadedMedia> {
    const response = await this.provider.uploadMedia(fileBuffer, mimeType, filename);

    // Persistir en Attachment para referencia futura
    await this.prisma.attachment.create({
      data: {
        storageKey: response.id, // usamos el mediaId como storage key
        mimeType,
        fileSizeBytes: BigInt(fileBuffer.byteLength),
        originalFilename: filename,
        messageId: messageId ?? null,
        citizenId: citizenId ?? null,
      },
    });

    return {
      mediaId: response.id,
      mimeType,
      originalFilename: filename,
      fileSizeBytes: fileBuffer.byteLength,
    };
  }

  /**
   * Descarga media de Meta por su mediaId.
   */
  async download(mediaId: string): Promise<Buffer> {
    return this.provider.downloadMedia(mediaId);
  }
}
