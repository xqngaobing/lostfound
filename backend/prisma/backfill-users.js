import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const encKey = process.env.ENC_KEY;
if (!encKey) {
  throw new Error("ENC_KEY is required");
}

const getKey = () => {
  const raw = Buffer.from(encKey, "base64");
  if (raw.length !== 32) {
    throw new Error("ENC_KEY must be 32 bytes base64");
  }
  return raw;
};

const decryptText = (payload) => {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
};

const run = async () => {
  const items = await prisma.item.findMany({ where: { publisherId: null } });
  const userByPhone = new Map();

  for (const item of items) {
    const phone = decryptText(item.publisherContact);
    let user = userByPhone.get(phone);
    if (!user) {
      const created = await prisma.user.create({
        data: {
          username: `用户${phone.slice(-4)}`,
          phone,
          passwordHash: "" // 需要管理员后续为用户设置密码
        }
      });
      user = created;
      userByPhone.set(phone, created);
    }
    await prisma.item.update({ where: { id: item.id }, data: { publisherId: user.id } });
  }

  console.log(`Backfill users completed. Updated ${items.length} item(s).`);
};

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
