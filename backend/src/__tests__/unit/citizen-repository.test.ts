/**
 * Unit tests: CitizenRepository
 *
 * Cubre el bug de duplicados por formato de teléfono:
 * - "+52..." y "52..." deben encontrar el mismo citizen
 * - findOrCreate con +52 y 52 no genera dos registros
 * - phone se almacena siempre sin + (formato canónico)
 */
import { LeadStatus, SourceChannel } from '@prisma/client';
import { CitizenRepository } from '../../services/repositories/citizen.repository';

function makePrismaMock() {
  const store: Record<string, object> = {};
  return {
    citizen: {
      findUnique: jest.fn(async ({ where }: { where: { phone: string } }) => store[where.phone] ?? null),
      create: jest.fn(async ({ data }: { data: { phone: string; name?: string; lastName?: string; sourceChannel: SourceChannel; leadStatus: LeadStatus } }) => {
        const citizen = { id: `cit-${Date.now()}`, ...data };
        store[data.phone] = citizen;
        return citizen;
      }),
      update: jest.fn(),
    },
    _store: store,
  };
}

describe('CitizenRepository — normalización canónica de teléfono', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let repo: CitizenRepository;

  beforeEach(() => {
    prisma = makePrismaMock();
    // @ts-ignore — mock parcial
    repo = new CitizenRepository(prisma);
  });

  it('findByPhone("+521234567890") y findByPhone("521234567890") encuentran el mismo registro', async () => {
    // Crear con formato canónico (sin +)
    await prisma.citizen.create({ data: { phone: '521234567890', sourceChannel: SourceChannel.whatsapp, leadStatus: LeadStatus.new } });

    const withPlus = await repo.findByPhone('+521234567890');
    const withoutPlus = await repo.findByPhone('521234567890');

    expect(withPlus).not.toBeNull();
    expect(withoutPlus).not.toBeNull();
    expect((withPlus as { phone: string }).phone).toBe('521234567890');
    expect(withPlus).toEqual(withoutPlus);
  });

  it('findOrCreate con "+52..." retorna ciudadano existente (sin crear duplicado)', async () => {
    // Pre-crear con formato sin +
    await repo.findOrCreate('521234567890');
    const callCountAfterFirst = prisma.citizen.create.mock.calls.length;
    expect(callCountAfterFirst).toBe(1);

    // findOrCreate con mismo número pero con + → debe encontrar existente
    await repo.findOrCreate('+521234567890');
    expect(prisma.citizen.create).toHaveBeenCalledTimes(1); // NO crea un segundo registro
  });

  it('findOrCreate con "52..." retorna ciudadano existente si fue creado con "+52..."', async () => {
    await repo.findOrCreate('+521234567890');
    expect(prisma.citizen.create).toHaveBeenCalledTimes(1);

    await repo.findOrCreate('521234567890');
    expect(prisma.citizen.create).toHaveBeenCalledTimes(1); // sin duplicado
  });

  it('phone guardado en DB no tiene "+" — formato solo dígitos', async () => {
    await repo.findOrCreate('+521234567890');

    const createCall = prisma.citizen.create.mock.calls[0][0];
    expect(createCall.data.phone).toBe('521234567890');
    expect(createCall.data.phone).not.toContain('+');
  });

  it('phone guardado en DB sin + cuando se pasa sin + de entrada', async () => {
    await repo.findOrCreate('521234567890');

    const createCall = prisma.citizen.create.mock.calls[0][0];
    expect(createCall.data.phone).toBe('521234567890');
  });
});
