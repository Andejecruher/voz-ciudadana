import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Colonias de Cintalapa de Figueroa, Chiapas
const colonies = [
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

// Departamentos de gobierno municipal
const departments = [
  'Presidencia Municipal',
  'Secretaría General',
  'Tesorería Municipal',
  'Obras Públicas',
  'Servicios Públicos',
  'Desarrollo Social',
  'Seguridad Pública',
  'Educación y Cultura',
  'Salud Municipal',
  'Medio Ambiente',
];

async function main() {
  console.log('🌱 Seeding database...');

  // Insertar colonias (upsert para idempotencia)
  for (const name of colonies) {
    await prisma.colony.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`✅ ${colonies.length} colonies seeded`);

  // Insertar departamentos
  for (const name of departments) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`✅ ${departments.length} departments seeded`);

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
