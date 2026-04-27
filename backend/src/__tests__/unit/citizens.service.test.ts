import { CitizensService } from '../../services/citizens.service';

function makePrismaMock() {
  const store: Record<string, any> = {};

  return {
    citizen: {
      findUnique: jest.fn(async ({ where }: { where: any }) => {
        // lookup by phone or id
        if (where.phone) return store[where.phone] ?? null;
        if (where.id) return Object.values(store).find((c: any) => c.id === where.id) ?? null;
        return null;
      }),
      create: jest.fn(async ({ data }: { data: any }) => {
        const id = `cit-${Date.now()}`;
        const obj = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
        store[data.phone] = obj;
        return obj;
      }),
      findMany: jest.fn(),
    },
    tag: {
      findUnique: jest.fn(),
    },
    citizenTag: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    conversation: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    _store: store,
  };
}

describe('CitizensService — unit', () => {
  it('crea un ciudadano normalizando el teléfono', async () => {
    const prisma = makePrismaMock();
    // @ts-ignore
    const svc = new CitizensService(prisma);

    const created = await svc.create({ phone: '+521234567890', name: 'Juan' });

    expect(prisma.citizen.create).toHaveBeenCalledTimes(1);
    const call = (prisma.citizen.create as jest.Mock).mock.calls[0][0];
    expect(call.data.phone).toBe('521234567890');
    expect(created.phone).toBe('521234567890');
  });

  it('list devuelve paginación cursor-based correctamente', async () => {
    const prisma = makePrismaMock();
    const rows = [
      {
        id: 'c1',
        phone: '521',
        name: 'A',
        lastName: 'X',
        email: null,
        sourceChannel: 'whatsapp',
        leadStatus: 'new',
        consentGiven: false,
        consentAt: null,
        neighborhood: null,
        neighborhoodId: null,
        interests: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'c2',
        phone: '522',
        name: 'B',
        lastName: 'Y',
        email: null,
        sourceChannel: 'whatsapp',
        leadStatus: 'new',
        consentGiven: false,
        consentAt: null,
        neighborhood: null,
        neighborhoodId: null,
        interests: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    prisma.citizen.findMany.mockResolvedValue(rows);

    // @ts-ignore
    const svc = new CitizensService(prisma);
    const result = await svc.list({ cursor: undefined, limit: 1, filters: {} });

    expect(result.items.length).toBe(1);
    expect(result.meta.hasNextPage).toBe(true);
    expect(result.meta.nextCursor).toBe('c1');
  });

  it('asigna una etiqueta a un ciudadano', async () => {
    const prisma = makePrismaMock();

    // preparar citizen y tag
    prisma.citizen.findUnique.mockResolvedValue({ id: 'cit-1' });
    prisma.tag.findUnique.mockResolvedValue({ id: 'tag-1', name: 'Etiqueta' });
    prisma.citizenTag.findFirst.mockResolvedValue(null);
    prisma.citizenTag.create.mockResolvedValue({
      id: 'ct-1',
      citizenId: 'cit-1',
      tagId: 'tag-1',
      assignedAt: new Date(),
    });

    // @ts-ignore
    const svc = new CitizensService(prisma);
    const created = await svc.assignTag('cit-1', 'tag-1', 'user-1');

    expect(prisma.citizen.findUnique).toHaveBeenCalled();
    expect(prisma.tag.findUnique).toHaveBeenCalled();
    expect(prisma.citizenTag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { citizenId: 'cit-1', tagId: 'tag-1', assignedById: 'user-1' },
      }),
    );
    expect(created).toBeDefined();
  });
});
