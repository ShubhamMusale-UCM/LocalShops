const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const shops = await prisma.shop.findMany();
    if (shops.length > 0) {
      const shopId = shops[0].id;
      console.log(`Updating shop ${shopId} with dummy logo...`);
      const updated = await prisma.shop.update({
        where: { id: shopId },
        data: { logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }
      });
      console.log("Updated shop:", updated.id, "Logo set to:", updated.logo);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
