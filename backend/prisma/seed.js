import crypto from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const encKey = process.env.ENC_KEY;
if (!encKey) {
  throw new Error("ENC_KEY is required for seeding");
}

const getKey = () => {
  const raw = Buffer.from(encKey, "base64");
  if (raw.length !== 32) {
    throw new Error("ENC_KEY must be 32 bytes base64");
  }
  return raw;
};

const encryptText = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
};

const maskContact = (value) => {
  if (/^1\d{10}$/.test(value)) {
    return value.replace(/(\d{3})\d+(\d{2})/, "$1****$2");
  }
  const [name, domain] = value.split("@");
  if (!domain) {
    return value.slice(0, 2) + "***";
  }
  return `${name.slice(0, 2)}***@${domain}`;
};

const seed = async () => {
  await prisma.report.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.item.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("123456", 10);

  const userA = await prisma.user.create({
    data: {
      username: "张老师",
      phone: "13800138000",
      passwordHash
    }
  });

  const userB = await prisma.user.create({
    data: {
      username: "李老师",
      phone: "13900139000",
      passwordHash
    }
  });

  const items = [
    {
      publisherId: userA.id,
      title: "黑色双肩包",
      category: "衣物",
      description: "在教学楼A一层自习区发现，包内有笔记本和文具盒。",
      images: [
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop"
      ],
      foundAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      locationText: "教学楼A一层自习区",
      status: "OPEN",
      publisherContact: userA.phone
    },
    {
      publisherId: userB.id,
      title: "校园一卡通",
      category: "证件类",
      description: "操场看台附近发现一张学生卡，卡套为蓝色。",
      images: [
        "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?q=80&w=1200&auto=format&fit=crop"
      ],
      foundAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      locationText: "操场看台",
      status: "OPEN",
      publisherContact: userB.phone
    },
    {
      publisherId: userA.id,
      title: "白色蓝牙耳机盒",
      category: "电子产品",
      description: "在食堂二楼靠窗座位找到，外壳有轻微划痕。",
      images: [
        "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=1200&auto=format&fit=crop"
      ],
      foundAt: new Date(Date.now() - 9 * 24 * 3600 * 1000),
      locationText: "食堂二楼靠窗座位",
      status: "CLAIMED",
      publisherContact: userA.phone
    }
  ];

  for (const item of items) {
    await prisma.item.create({
      data: {
        publisherId: item.publisherId,
        title: item.title,
        category: item.category,
        description: item.description,
        images: item.images,
        foundAt: item.foundAt,
        locationText: item.locationText,
        status: item.status,
        publisherContact: encryptText(item.publisherContact),
        publisherHint: maskContact(item.publisherContact)
      }
    });
  }

  const firstItem = await prisma.item.findFirst({ where: { status: "OPEN" } });
  if (firstItem) {
    await prisma.claim.create({
      data: {
        itemId: firstItem.id,
        claimantId: userB.id,
        claimantName: "李老师",
        claimantContact: encryptText("13900139000"),
        verificationInfo: encryptText("包内有蓝色笔记本，封面写着ZY-01")
      }
    });

    await prisma.report.create({
      data: {
        itemId: firstItem.id,
        reporterId: userB.id,
        type: "OTHER",
        note: "请核实是否为近期遗失物品"
      }
    });
  }
};

seed()
  .then(() => {
    console.log("Seed completed");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
