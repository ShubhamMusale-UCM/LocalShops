const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User" 
    ADD COLUMN IF NOT EXISTS "deletionStatus" TEXT, 
    ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMPTZ;
  `);
  console.log("SUCCESS: Deletion columns added or verified in database.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
