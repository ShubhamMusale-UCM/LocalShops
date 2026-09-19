const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const shops = await prisma.shop.findMany({
      select: {
        id: true,
        name: true,
        logo: true,
        ownerId: true,
        products: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });
    console.log("All Shops in DB:", JSON.stringify(shops, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
