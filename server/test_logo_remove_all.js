const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const shops = await prisma.shop.findMany();
    for (const shop of shops) {
      if (shop.logo && shop.logo.startsWith('data:image/png;base64,iVBORw0KGgo')) {
        console.log(`Removing dummy logo from ${shop.id}...`);
        await prisma.shop.update({
          where: { id: shop.id },
          data: { logo: null }
        });
      }
    }
    console.log("Done");
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
