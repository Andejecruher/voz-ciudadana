import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const toNameLower = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// Colonias/barrios de Cintalapa de Figueroa, Chiapas
const neighborhoodNames = [
  'Centro',
  'Barrio San Sebastián',
  'Barrio La Cruz',
  'Barrio El Calvario',
  'Barrio El Cerrito',
  'Colonia Ampliación Centro',
  'Colonia Azteca',
  'Colonia Belisario Domínguez',
  'Colonia El Porvenir',
  'Colonia Emiliano Zapata',
  'Colonia Independencia',
  'Colonia La Ceiba',
  'Colonia Las Flores',
  'Colonia Lomas del Carmen',
  'Colonia Magisterial',
  'Colonia Nueva España',
  'Colonia Ocuilapa',
  'Colonia Paraíso',
  'Colonia Plan de Ayala',
  'Colonia Solidaridad',
  'Colonia Tierra y Libertad',
  'Colonia Vista Hermosa',
  'Fraccionamiento Las Palmas',
  'Ejido Cintalapa',
  'Ranchería La Libertad',
];

async function main() {
  console.log('🌱 Seeding database...');

  // Insertar neighborhoods (upsert por name para idempotencia)
  for (const name of neighborhoodNames) {
    await prisma.neighborhood.upsert({
      where: { name },
      update: { nameLower: toNameLower(name) },
      create: { name, nameLower: toNameLower(name) },
    });
  }
  console.log(`✅ ${neighborhoodNames.length} neighborhoods seeded`);

  console.log('🎉 Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
