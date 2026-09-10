import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categorySeeds = [
  ['Furniture & home', 'furniture-home'],
  ['Electronics', 'electronics'],
  ['Kids & family', 'kids-family'],
  ['Home services', 'home-services'],
  ['Food & coffee', 'food-coffee'],
  ['Health & fitness', 'health-fitness'],
] as const;

// These are intentionally disabled placeholders until the launch team manually verifies labels.
const zoneSeeds = [1, 2, 3, 4].map((number) => ({
  name: `Zone ${number} (configure)`,
  slug: `zone-${number}-configure`,
  sortOrder: number,
  isActive: false,
}));

async function main() {
  for (const [index, [name, slug]] of categorySeeds.entries()) {
    await prisma.category.upsert({
      where: { slug },
      update: { name, sortOrder: index },
      create: { name, slug, sortOrder: index },
    });
  }

  for (const zone of zoneSeeds) {
    await prisma.zone.upsert({ where: { slug: zone.slug }, update: zone, create: zone });
  }

  // Keep commercial plans inactive and price-less until validated pricing is configured in admin.
  for (const plan of [
    { key: 'featured-listing', name: 'Featured listing', description: 'Fixed-duration visibility boost; clearly labeled.', durationDays: null },
    { key: 'business-pro', name: 'Business Pro', description: 'Enhanced profile, analytics and offers.', durationDays: null },
    { key: 'service-pro', name: 'Service Pro', description: 'Priority tools and analytics; no ranking promises.', durationDays: null },
  ]) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: { name: plan.name, description: plan.description, durationDays: plan.durationDays, isActive: false, priceMinor: null },
      create: { ...plan, isActive: false, priceMinor: null },
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn('ADMIN_EMAIL is not set; skipped admin user creation. Configure it in the environment for a first admin.');
    return;
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: { email: adminEmail, role: 'ADMIN', status: 'ACTIVE', profile: { create: { displayName: 'Madinaty Deals Admin' } } },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
