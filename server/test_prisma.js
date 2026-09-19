const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const listings = await prisma.promotedListing.findMany({
      where: {
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
        product: { 
          is: { 
            isActive: true
          } 
        },
      }
    });
    console.log(listings);
  } catch(e) {
    console.error(e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
