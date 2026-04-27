/**
 * Department Router — Strategy Pattern para enrutamiento de conversaciones.
 *
 * Cada estrategia implementa DepartmentRoutingStrategy.
 * El router itera las estrategias en orden y retorna el primer departamento que
 * acepta el mensaje.
 */
import { PrismaService } from '../prisma.service';
import { WaInboundMessage } from '../../types/whatsapp.types';
import { extractMessageText } from '../../utils/wa-message-parser';

// ─── Interface de estrategia ──────────────────────────────────────────────────

export interface RoutingContext {
  message: WaInboundMessage;
  citizenId: string;
  citizenInterests?: string[];
  conversationId: string;
}

export interface DepartmentRoutingStrategy {
  name: string;
  /** Retorna el slug del departamento o undefined si esta estrategia no aplica */
  route(ctx: RoutingContext): Promise<string | undefined>;
}

// ─── Estrategia: Keywords en el texto ─────────────────────────────────────────

export class KeywordRoutingStrategy implements DepartmentRoutingStrategy {
  name = 'keyword';

  constructor(private readonly prisma: PrismaService) {}

  async route(ctx: RoutingContext): Promise<string | undefined> {
    const text = extractMessageText(ctx.message)?.toLowerCase();
    if (!text) return undefined;

    const departments = await this.prisma.department.findMany({
      where: { isActive: true },
      select: { slug: true, keywords: true },
    });

    for (const dept of departments) {
      if (dept.keywords.some((kw: string) => text.includes(kw.toLowerCase()))) {
        return dept.slug;
      }
    }

    return undefined;
  }
}

// ─── Estrategia: Intereses del ciudadano ──────────────────────────────────────

export class InterestRoutingStrategy implements DepartmentRoutingStrategy {
  name = 'interest';

  constructor(private readonly prisma: PrismaService) {}

  async route(ctx: RoutingContext): Promise<string | undefined> {
    if (!ctx.citizenInterests || ctx.citizenInterests.length === 0) return undefined;

    // Buscar departamento cuyo slug coincida con el primer interés del ciudadano
    const dept = await this.prisma.department.findFirst({
      where: {
        isActive: true,
        slug: { in: ctx.citizenInterests },
      },
      select: { slug: true },
    });

    return dept?.slug;
  }
}

// ─── Estrategia: Fallback (departamento general) ──────────────────────────────

export class FallbackRoutingStrategy implements DepartmentRoutingStrategy {
  name = 'fallback';

  route(_ctx: RoutingContext): Promise<string | undefined> {
    return Promise.resolve('general'); // slug del departamento por defecto
  }
}

// ─── DepartmentRouterStrategy (composición) ──────────────────────────────────

export class DepartmentRouterStrategy {
  private readonly strategies: DepartmentRoutingStrategy[];

  constructor(prisma: PrismaService) {
    this.strategies = [
      new KeywordRoutingStrategy(prisma),
      new InterestRoutingStrategy(prisma),
      new FallbackRoutingStrategy(),
    ];
  }

  /**
   * Itera las estrategias en orden y retorna el primer departamento que acepta.
   */
  async route(ctx: RoutingContext): Promise<string> {
    for (const strategy of this.strategies) {
      const result = await strategy.route(ctx);
      if (result) {
        console.log(`[DepartmentRouter] Estrategia "${strategy.name}" → dept: ${result}`);
        return result;
      }
    }
    return 'general'; // fallback final
  }
}
