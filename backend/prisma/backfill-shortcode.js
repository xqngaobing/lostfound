import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const generateCode = async () => {
  for (let i = 0; i < 20; i += 1) {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const exists = await prisma.item.findUnique({ where: { shortCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("无法生成物品编号");
};

const run = async () => {
  const items = await prisma.item.findMany({ where: { shortCode: null } });
  for (const item of items) {
    const code = await generateCode();
    await prisma.item.update({ where: { id: item.id }, data: { shortCode: code } });
  }
  console.log(`Backfill completed. Updated ${items.length} item(s).`);
};

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
