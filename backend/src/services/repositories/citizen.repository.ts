/**
 * Repository para Citizen.
 * Reutiliza el modelo existente sin duplicar acceso.
 */
import { Citizen, LeadStatus, SourceChannel } from '@prisma/client';
import { normalizePhoneForStorage } from '../../utils/phone-normalizer';
import { PrismaService } from '../prisma.service';

export class CitizenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPhone(rawPhone: string): Promise<Citizen | null> {
    const phone = normalizePhoneForStorage(rawPhone);
    return this.prisma.citizen.findUnique({
      where: { phone },
    });
  }

  async findOrCreate(rawPhone: string, profileName?: string): Promise<Citizen> {
    const phone = normalizePhoneForStorage(rawPhone);
    const existing = await this.findByPhone(phone);
    if (existing) return existing;

    const nameParts = profileName?.split(' ') ?? [];
    return this.prisma.citizen.create({
      data: {
        phone,
        name: nameParts[0],
        lastName: nameParts.slice(1).join(' ') || undefined,
        sourceChannel: SourceChannel.whatsapp,
        leadStatus: LeadStatus.new,
      },
    });
  }

  async updateLeadStatus(citizenId: string, status: LeadStatus): Promise<Citizen> {
    return this.prisma.citizen.update({
      where: { id: citizenId },
      data: { leadStatus: status },
    });
  }

  async giveConsent(citizenId: string): Promise<Citizen> {
    return this.prisma.citizen.update({
      where: { id: citizenId },
      data: { consentGiven: true, consentAt: new Date() },
    });
  }
}
