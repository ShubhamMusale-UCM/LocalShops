const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
  const res = await prisma.$queryRaw`SELECT p.id FROM "Product" p LEFT JOIN "Shop" s ON p."shopId" = s.id WHERE s.name ILIKE '%Shubha%'`; 
  console.log(res); 
} 
main().catch(console.error).finally(() => process.exit(0));
