const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
  const res = await prisma.product.findMany({ select: { id: true, name: true, isActive: true, shop: { select: { isActive: true } } } });
  console.log(JSON.stringify(res, null, 2)); 
} 
main().catch(console.error).finally(() => process.exit(0));
