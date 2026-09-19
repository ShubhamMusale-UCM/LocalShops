const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const shops = await prisma.shop.findMany({ select: { name: true, logo: true, coverImage: true } });
    console.log("Shops in DB:");
    shops.forEach(s => console.log(s.name, s.logo ? 'Has Logo' : 'NO LOGO'));
  } finally {
    await prisma.$disconnect();
  }
}
run();
