const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const shops = await prisma.shop.findMany();
    for (const shop of shops) {
      if (shop.logo) {
        console.log(`Shop ${shop.id} has logo starting with: ${shop.logo.substring(0, 50)}`);
      } else {
        console.log(`Shop ${shop.id} has no logo`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
