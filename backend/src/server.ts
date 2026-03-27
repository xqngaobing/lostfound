import dotenv from "dotenv";
import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import multer from "multer";
import sharp from "sharp";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import os from "os";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { config } from "./config.js";
import {
  adminStatusUpdateSchema,
  adminUserCreateSchema,
  adminUserQuerySchema,
  adminUserUpdateSchema,
  adminItemBatchDeleteSchema,
  changePasswordSchema,
  claimStatusUpdateSchema,
  claimSchema,
  createItemSchema,
  itemQuerySchema,
  loginSchema,
  registerSchema,
  reportSchema,
  statusUpdateSchema
} from "./validators.js";
import { decryptText, encryptText } from "./crypto.js";

dotenv.config();

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors({
    origin: config.corsOrigins.includes("*") ? true : config.corsOrigins,
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use(cookieParser());

const uploadRoot = path.resolve(process.cwd(), config.uploadDir);
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}
app.use("/uploads", express.static(uploadRoot));

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.maxImageSizeMb * 1024 * 1024
  }
});

const authCookieName = "lf_auth";

const signToken = (userId: string): string => {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: "7d" });
};

const getUserId = (req: express.Request): string | null => {
  const token = req.cookies?.[authCookieName];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
};

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: "请先登录" });
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(401).json({ success: false, error: "请先登录" });
  }
  (req as express.Request & { user: typeof user }).user = user;
  return next();
};

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.header("x-admin-token");
  if (!token || token !== config.adminToken) {
    return res.status(401).json({ success: false, error: "无权限" });
  }
  return next();
};

const maskContact = (value: string): string => {
  if (/^1\d{10}$/.test(value)) {
    return value.replace(/(\d{3})\d+(\d{2})/, "$1****$2");
  }
  const [name, domain] = value.split("@");
  if (!domain) {
    return value.slice(0, 2) + "***";
  }
  return `${name.slice(0, 2)}***@${domain}`;
};

const toCode = (seq: number): string => seq.toString().padStart(5, "0");

const isUniqueError = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false;
  return (err as { code?: string }).code === "P2002";
};

const createNotification = async (payload: {
  userId: string;
  type: "CLAIM_CREATED" | "CLAIM_STATUS" | "ITEM_STATUS" | "ITEM_CREATED" | "ITEM_EXPIRE" | "ITEM_REPORTED";
  title: string;
  body: string;
  meta?: Record<string, unknown>;
  itemId?: string | null;
  dedupeKey?: string;
}) => {
  try {
    await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        meta: payload.meta as any,
        itemId: payload.itemId ?? undefined,
        dedupeKey: payload.dedupeKey
      }
    });
  } catch (err) {
    if (payload.dedupeKey && isUniqueError(err)) {
      return;
    }
    throw err;
  }
};

const createExpireNotifications = async (userId: string) => {
  const days = Number.isFinite(config.itemExpireDays) ? config.itemExpireDays : 30;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - Math.max(days, 1));

  const items = await prisma.item.findMany({
    where: {
      publisherId: userId,
      status: "OPEN",
      createdAt: { lte: cutoff }
    },
    select: { id: true, seq: true, title: true, createdAt: true }
  });

  await Promise.all(
    items.map((item) =>
      createNotification({
        userId,
        type: "ITEM_EXPIRE",
        title: "物品到期提醒",
        body: `你的物品“${item.title}”已发布超过 ${days} 天，建议续期或下架。`,
        meta: {
          itemCode: toCode(item.seq),
          itemTitle: item.title,
          createdAt: item.createdAt.toISOString(),
          expireDays: days
        },
        itemId: item.id,
        dedupeKey: `ITEM_EXPIRE:${item.id}`
      })
    )
  );
};

const statusLabel = (status: string): string => {
  if (status === "OPEN") return "招领中";
  if (status === "CLAIMING") return "认领中";
  if (status === "CLAIMED") return "已认领";
  if (status === "REMOVED") return "已下架";
  return status;
};

const refreshItemStatusAfterClaim = async (itemId: string) => {
  const [item, pendingCount] = await Promise.all([
    prisma.item.findUnique({ where: { id: itemId }, select: { status: true } }),
    prisma.claim.count({ where: { itemId, status: "PENDING" } })
  ]);
  if (!item) return;
  if (item.status === "CLAIMED") return;
  if (pendingCount === 0 && item.status === "CLAIMING") {
    await prisma.item.update({ where: { id: itemId }, data: { status: "OPEN" } });
  }
};

app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.get("/api/system/lan-ips", (_req, res) => {
  const nets = os.networkInterfaces() as Record<string, os.NetworkInterfaceInfo[]>;
  const ips: string[] = [];
  Object.values(nets).forEach((iface) => {
    iface?.forEach((addr) => {
      if (addr.family === "IPv4" && !addr.internal) {
        ips.push(addr.address);
      }
    });
  });
  return res.json({ success: true, data: { ips } });
});

app.post("/api/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.length ? issue.path.join(".") : "字段";
    return res.status(400).json({ success: false, error: `${field}: ${issue?.message ?? "注册信息不完整"}` });
  }
  const existing = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
  if (existing) {
    return res.status(400).json({ success: false, error: "手机号已注册" });
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      username: parsed.data.username,
      phone: parsed.data.phone,
      passwordHash
    }
  });
  const token = signToken(user.id);
  res.cookie(authCookieName, token, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: true,
    domain: config.cookieDomain
  });
  return res.json({ success: true, data: { id: user.id, username: user.username, phone: user.phone } });
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "请输入正确的手机号与密码" });
  }
  const user = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
  if (!user) {
    return res.status(400).json({ success: false, error: "该手机号未注册，请先注册" });
  }
  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    return res.status(400).json({ success: false, error: "密码错误" });
  }
  const token = signToken(user.id);
  res.cookie(authCookieName, token, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: true,
    domain: config.cookieDomain
  });
  return res.json({ success: true, data: { id: user.id, username: user.username, phone: user.phone } });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(authCookieName);
  return res.json({ success: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = (req as express.Request & { user: { id: string; username: string; phone: string } }).user;
  return res.json({ success: true, data: { id: user.id, username: user.username, phone: user.phone } });
});

app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "参数不合法" });
  }
  const user = (req as express.Request & { user: { id: string; passwordHash: string } }).user;
  const ok = await bcrypt.compare(parsed.data.oldPassword, user.passwordHash);
  if (!ok) {
    return res.status(400).json({ success: false, error: "旧密码不正确" });
  }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return res.json({ success: true });
});

app.get("/api/notifications", requireAuth, async (req, res) => {
  const user = (req as express.Request & { user: { id: string } }).user;
  await createExpireNotifications(user.id);

  const pageNum = Math.max(Number(req.query.page ?? 1), 1);
  const sizeNum = Math.min(Math.max(Number(req.query.pageSize ?? 20), 1), 50);
  const unreadOnly = req.query.unread === "1";

  const where = {
    userId: user.id,
    ...(unreadOnly ? { readAt: null } : {})
  };

  const [total, items] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * sizeNum,
      take: sizeNum,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        meta: true,
        itemId: true,
        readAt: true,
        createdAt: true
      }
    })
  ]);

  return res.json({
    success: true,
    data: {
      items,
      pagination: {
        page: pageNum,
        pageSize: sizeNum,
        total,
        totalPages: Math.ceil(total / sizeNum)
      }
    }
  });
});

app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
  const user = (req as express.Request & { user: { id: string } }).user;
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification || notification.userId !== user.id) {
    return res.status(404).json({ success: false, error: "未找到消息" });
  }
  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() }
  });
  return res.json({ success: true, data: updated });
});

app.post("/api/uploads", requireAuth, upload.array("images", config.maxImageCount), async (req, res) => {
  const files = req.files as any;
  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, error: "请上传图片" });
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const saved: string[] = [];
  for (const file of files) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const filename = `${id}.webp`;
    const outputPath = path.join(uploadRoot, filename);
    await sharp(file.buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outputPath);
    saved.push(`${baseUrl}/uploads/${filename}`);
  }

  return res.json({ success: true, data: saved });
});

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, error: "图片过大，单张最大 15MB" });
    }
    return res.status(400).json({ success: false, error: "图片上传失败" });
  }
  return next(err);
});

app.get("/api/items", async (req, res) => {
  const parsed = itemQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "参数不合法" });
  }
  const { q, category, city, status, sort, timeRange, page, pageSize } = parsed.data;
  const pageNum = Math.max(Number(page ?? 1), 1);
  const sizeNum = Math.min(Math.max(Number(pageSize ?? 12), 1), 50);

  const where: Record<string, unknown> = {
    status: status ? status : { in: ["OPEN", "CLAIMING"] }
  };
  if (category) {
    where.category = category;
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { locationText: { contains: q, mode: "insensitive" } }
    ];
  }
  if (city) {
    where.locationText = { contains: city, mode: "insensitive" };
  }
  if (timeRange && timeRange !== "all") {
    const now = new Date();
    const start = new Date(now);
    if (timeRange === "week") {
      start.setDate(now.getDate() - 7);
    }
    if (timeRange === "month") {
      start.setMonth(now.getMonth() - 1);
    }
    where.createdAt = { gte: start };
  }

  const [total, items] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      orderBy: sort === "views" ? { viewCount: "desc" } : { createdAt: "desc" },
      skip: (pageNum - 1) * sizeNum,
      take: sizeNum,
      select: {
        id: true,
        seq: true,
        title: true,
        category: true,
        images: true,
        foundAt: true,
        locationText: true,
        status: true,
        createdAt: true,
        viewCount: true
      }
    })
  ]);

  return res.json({
    success: true,
    data: {
      items: items.map((item) => ({ ...item, code: toCode(item.seq) })),
      pagination: {
        page: pageNum,
        pageSize: sizeNum,
        total,
        totalPages: Math.ceil(total / sizeNum)
      }
    }
  });
});

app.get("/api/items/:id", async (req, res) => {
  const seq = Number(req.params.id);
  if (!Number.isFinite(seq)) {
    return res.status(400).json({ success: false, error: "物品编号不合法" });
  }
  const item = await prisma.item.findUnique({
    where: { seq },
    select: {
      id: true,
      seq: true,
      title: true,
      category: true,
      description: true,
      images: true,
      foundAt: true,
      locationText: true,
      status: true,
      createdAt: true,
      viewCount: true
    }
  });
  if (!item) {
    return res.status(404).json({ success: false, error: "未找到物品" });
  }

  await prisma.item.update({
    where: { id: item.id },
    data: { viewCount: { increment: 1 } }
  });

  return res.json({ success: true, data: { ...item, code: toCode(item.seq), viewCount: item.viewCount + 1 } });
});

app.post("/api/items", requireAuth, async (req, res) => {
  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.length ? issue.path.join(".") : "字段";
    return res.status(400).json({ success: false, error: `${field}: ${issue?.message ?? "提交信息不完整"}` });
  }
  const data = parsed.data;
  const user = (req as express.Request & { user: { id: string; phone: string } }).user;
  const contactEncrypted = encryptText(user.phone, config.encKey);
  const hint = maskContact(user.phone);

  const item = await prisma.item.create({
    data: {
      publisherId: user.id,
      title: data.title,
      category: data.category,
      description: data.description,
      images: data.images,
      foundAt: new Date(data.foundAt),
      locationText: data.locationText,
      publisherContact: contactEncrypted,
      publisherHint: hint
    },
    select: {
      id: true,
      seq: true,
      createdAt: true,
      title: true
    }
  });

  return res.json({
    success: true,
    data: {
      id: item.id,
      code: toCode(item.seq),
      createdAt: item.createdAt
    }
  });
});

app.post("/api/items/:id/claims", requireAuth, async (req, res) => {
  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.length ? issue.path.join(".") : "字段";
    return res.status(400).json({ success: false, error: `${field}: ${issue?.message ?? "申请信息不完整"}` });
  }
  const seq = Number(req.params.id);
  if (!Number.isFinite(seq)) {
    return res.status(400).json({ success: false, error: "物品编号不合法" });
  }
  const item = await prisma.item.findUnique({ where: { seq } });
  if (!item || (item.status !== "OPEN" && item.status !== "CLAIMING")) {
    return res.status(400).json({ success: false, error: "该物品无法认领" });
  }
  const user = (req as express.Request & { user: { id: string } }).user;

  const claim = await prisma.claim.create({
    data: {
      itemId: item.id,
      claimantId: user.id,
      claimantName: parsed.data.claimantName,
      claimantContact: encryptText(parsed.data.claimantContact, config.encKey),
      verificationInfo: encryptText(parsed.data.verificationInfo, config.encKey)
    },
    select: {
      id: true,
      createdAt: true
    }
  });

  if (item.status === "OPEN") {
    await prisma.item.update({
      where: { id: item.id },
      data: { status: "CLAIMING" }
    });
  }

  if (item.publisherId) {
    await createNotification({
      userId: item.publisherId,
      type: "CLAIM_CREATED",
      title: "收到新的认领申请",
      body: `${parsed.data.claimantName} 申请认领“${item.title}”，联系方式：${parsed.data.claimantContact}。`,
      meta: {
        itemCode: toCode(item.seq),
        itemTitle: item.title,
        claimantName: parsed.data.claimantName,
        claimantContact: parsed.data.claimantContact,
        claimId: claim.id
      },
      itemId: item.id
    });
  }

  await createNotification({
    userId: user.id,
    type: "CLAIM_STATUS",
    title: "认领申请已提交",
    body: `你已提交“${item.title}”的认领申请，等待物品发布者处理。`,
    meta: {
      itemCode: toCode(item.seq),
      itemTitle: item.title,
      status: "PENDING",
      claimId: claim.id
    },
    itemId: item.id,
    dedupeKey: `CLAIM_SUBMITTED:${claim.id}`
  });

  return res.json({ success: true, data: claim });
});

app.get("/api/items/:id/manage", requireAuth, async (req, res) => {
  const seq = Number(req.params.id);
  if (!Number.isFinite(seq)) {
    return res.status(400).json({ success: false, error: "物品编号不合法" });
  }
  const item = await prisma.item.findUnique({
    where: { seq },
    include: { claims: true }
  });
  if (!item) {
    return res.status(404).json({ success: false, error: "未找到物品" });
  }
  const user = (req as express.Request & { user: { id: string } }).user;
  if (item.publisherId !== user.id) {
    return res.status(403).json({ success: false, error: "无权限" });
  }
  const claims = item.claims.map((claim) => ({
    id: claim.id,
    claimantName: claim.claimantName,
    claimantContact: decryptText(claim.claimantContact, config.encKey),
    verificationInfo: decryptText(claim.verificationInfo, config.encKey),
    status: claim.status,
    createdAt: claim.createdAt
  }));

  return res.json({
    success: true,
    data: {
      item: {
        id: item.id,
        code: toCode(item.seq),
        title: item.title,
        category: item.category,
        description: item.description,
        images: item.images,
        foundAt: item.foundAt,
        locationText: item.locationText,
        status: item.status,
        createdAt: item.createdAt,
        viewCount: item.viewCount
      },
      claims
    }
  });
});

app.patch("/api/items/:id/status", requireAuth, async (req, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "状态不合法" });
  }
  const seq = Number(req.params.id);
  if (!Number.isFinite(seq)) {
    return res.status(400).json({ success: false, error: "物品编号不合法" });
  }
  const item = await prisma.item.findUnique({ where: { seq } });
  if (!item) {
    return res.status(404).json({ success: false, error: "未找到物品" });
  }
  const user = (req as express.Request & { user: { id: string } }).user;
  if (item.publisherId !== user.id) {
    return res.status(403).json({ success: false, error: "无权限" });
  }
  const updated = await prisma.item.update({
    where: { id: item.id },
    data: { status: parsed.data.status }
  });
  return res.json({ success: true, data: updated });
});

app.patch("/api/claims/:id/status", requireAuth, async (req, res) => {
  const parsed = claimStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "状态不合法" });
  }

  const user = (req as express.Request & { user: { id: string } }).user;
  const claim = await prisma.claim.findUnique({
    where: { id: req.params.id },
    include: { item: true, claimant: true }
  });
  if (!claim) {
    return res.status(404).json({ success: false, error: "未找到认领记录" });
  }
  if (claim.status !== "PENDING") {
    return res.status(400).json({ success: false, error: "当前认领状态无法修改" });
  }

  const isPublisher = claim.item.publisherId === user.id;
  const isClaimant = claim.claimantId === user.id;
  if (parsed.data.status === "WITHDRAWN" && !isClaimant) {
    return res.status(403).json({ success: false, error: "无权限撤回" });
  }
  if ((parsed.data.status === "APPROVED" || parsed.data.status === "REJECTED") && !isPublisher) {
    return res.status(403).json({ success: false, error: "无权限处理" });
  }

  const updated = await prisma.claim.update({
    where: { id: claim.id },
    data: { status: parsed.data.status }
  });

  if (parsed.data.status === "APPROVED") {
    await prisma.item.update({
      where: { id: claim.itemId },
      data: { status: "CLAIMED" }
    });
  } else {
    await refreshItemStatusAfterClaim(claim.itemId);
  }

  if (claim.claimantId) {
    await createNotification({
      userId: claim.claimantId,
      type: "CLAIM_STATUS",
      title: "认领进度更新",
      body: `你对“${claim.item.title}”的认领申请已${parsed.data.status === "APPROVED" ? "通过" : parsed.data.status === "REJECTED" ? "被拒绝" : "撤回"}。`,
      meta: {
        itemCode: toCode(claim.item.seq),
        itemTitle: claim.item.title,
        status: parsed.data.status,
        claimId: claim.id
      },
      itemId: claim.itemId
    });
  }

  if (parsed.data.status === "WITHDRAWN" && claim.item.publisherId) {
    await createNotification({
      userId: claim.item.publisherId,
      type: "CLAIM_STATUS",
      title: "认领申请已撤回",
      body: `“${claim.item.title}”的认领申请已被申请人撤回。`,
      meta: {
        itemCode: toCode(claim.item.seq),
        itemTitle: claim.item.title,
        status: parsed.data.status,
        claimId: claim.id
      },
      itemId: claim.itemId
    });
  }

  return res.json({ success: true, data: updated });
});

app.post("/api/reports", requireAuth, async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "举报信息不完整" });
  }
  const seq = Number(parsed.data.itemCode);
  const item = await prisma.item.findUnique({ where: { seq } });
  if (!item) {
    return res.status(404).json({ success: false, error: "未找到物品" });
  }
  const user = (req as express.Request & { user: { id: string } }).user;
  const report = await prisma.report.create({
    data: {
      itemId: item.id,
      reporterId: user.id,
      type: parsed.data.type,
      note: parsed.data.note ?? undefined
    }
  });

  if (item.publisherId) {
    await createNotification({
      userId: item.publisherId,
      type: "ITEM_REPORTED",
      title: "物品被举报提醒",
      body: `你的物品“${item.title}”收到举报，请核实内容并及时处理。`,
      meta: {
        itemCode: toCode(item.seq),
        itemTitle: item.title,
        reportType: parsed.data.type
      },
      itemId: item.id
    });
  }

  return res.json({ success: true, data: report });
});

app.get("/api/my/items", requireAuth, async (req, res) => {
  const user = (req as express.Request & { user: { id: string } }).user;
  const items = await prisma.item.findMany({
    where: { publisherId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      seq: true,
      title: true,
      images: true,
      status: true,
      locationText: true,
      createdAt: true
    }
  });
  return res.json({
    success: true,
    data: items.map((item) => ({ ...item, code: toCode(item.seq) }))
  });
});

app.get("/api/my/claims", requireAuth, async (req, res) => {
  const user = (req as express.Request & { user: { id: string } }).user;
  const claims = await prisma.claim.findMany({
    where: { claimantId: user.id },
    orderBy: { createdAt: "desc" },
    include: { item: true }
  });
  const mapped = claims.map((claim) => ({
    id: claim.id,
    itemTitle: claim.item.title,
    itemCode: toCode(claim.item.seq),
    status: claim.status,
    createdAt: claim.createdAt
  }));
  return res.json({ success: true, data: mapped });
});

app.get("/api/my/received-claims", requireAuth, async (req, res) => {
  const user = (req as express.Request & { user: { id: string } }).user;
  const claims = await prisma.claim.findMany({
    where: { item: { publisherId: user.id } },
    orderBy: { createdAt: "desc" },
    include: { item: true }
  });
  const mapped = claims.map((claim) => ({
    id: claim.id,
    itemId: claim.itemId,
    itemTitle: claim.item.title,
    itemCode: toCode(claim.item.seq),
    claimantName: claim.claimantName,
    claimantContact: decryptText(claim.claimantContact, config.encKey),
    verificationInfo: decryptText(claim.verificationInfo, config.encKey),
    status: claim.status,
    createdAt: claim.createdAt
  }));
  return res.json({ success: true, data: mapped });
});

app.get("/api/admin/items", requireAdmin, async (_req, res) => {
  const items = await prisma.item.findMany({
    orderBy: { createdAt: "desc" },
    include: { publisher: true }
  });
  const mapped = items.map((item) => ({
    id: item.id,
    code: toCode(item.seq),
    title: item.title,
    status: item.status,
    createdAt: item.createdAt,
    publisherContact: item.publisher?.phone ?? ""
  }));
  return res.json({ success: true, data: mapped });
});

app.get("/api/admin/claims", requireAdmin, async (_req, res) => {
  const claims = await prisma.claim.findMany({
    orderBy: { createdAt: "desc" },
    include: { item: true, claimant: true }
  });
  const mapped = claims.map((claim) => ({
    id: claim.id,
    itemId: claim.itemId,
    itemTitle: claim.item.title,
    claimantName: claim.claimantName,
    claimantContact: decryptText(claim.claimantContact, config.encKey),
    verificationInfo: decryptText(claim.verificationInfo, config.encKey),
    status: claim.status,
    createdAt: claim.createdAt
  }));
  return res.json({ success: true, data: mapped });
});

app.patch("/api/admin/claims/:id/status", requireAdmin, async (req, res) => {
  const parsed = claimStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "状态不合法" });
  }

  const claim = await prisma.claim.findUnique({
    where: { id: req.params.id },
    include: { item: true }
  });
  if (!claim) {
    return res.status(404).json({ success: false, error: "未找到认领记录" });
  }
  if (claim.status !== "PENDING") {
    return res.status(400).json({ success: false, error: "当前认领状态无法修改" });
  }

  const updated = await prisma.claim.update({
    where: { id: claim.id },
    data: { status: parsed.data.status }
  });

  if (parsed.data.status === "APPROVED") {
    await prisma.item.update({
      where: { id: claim.itemId },
      data: { status: "CLAIMED" }
    });
  } else {
    await refreshItemStatusAfterClaim(claim.itemId);
  }

  if (claim.claimantId) {
    await createNotification({
      userId: claim.claimantId,
      type: "CLAIM_STATUS",
      title: "认领进度更新",
      body: `你对“${claim.item.title}”的认领申请已${parsed.data.status === "APPROVED" ? "通过" : parsed.data.status === "REJECTED" ? "被拒绝" : "撤回"}。`,
      meta: {
        itemCode: toCode(claim.item.seq),
        itemTitle: claim.item.title,
        status: parsed.data.status,
        claimId: claim.id
      },
      itemId: claim.itemId
    });
  }

  if (claim.item.publisherId) {
    await createNotification({
      userId: claim.item.publisherId,
      type: "CLAIM_STATUS",
      title: "认领进度更新",
      body: `“${claim.item.title}”的认领申请已被管理员标记为${parsed.data.status === "APPROVED" ? "通过" : parsed.data.status === "REJECTED" ? "拒绝" : "撤回"}。`,
      meta: {
        itemCode: toCode(claim.item.seq),
        itemTitle: claim.item.title,
        status: parsed.data.status,
        claimId: claim.id
      },
      itemId: claim.itemId
    });
  }

  return res.json({ success: true, data: updated });
});

app.get("/api/admin/reports", requireAdmin, async (_req, res) => {
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    include: { item: true, reporter: true }
  });
  const mapped = reports.map((report) => ({
    id: report.id,
    type: report.type,
    note: report.note,
    createdAt: report.createdAt,
    item: {
      id: report.item.id,
      title: report.item.title,
      status: report.item.status
    }
  }));
  return res.json({ success: true, data: mapped });
});

app.patch("/api/admin/items/:id/status", requireAdmin, async (req, res) => {
  const parsed = adminStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "状态不合法" });
  }
  const item = await prisma.item.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status }
  });

  if (item.publisherId) {
    await createNotification({
      userId: item.publisherId,
      type: "ITEM_STATUS",
      title: "物品状态变更提醒",
      body: `你的物品“${item.title}”已被标记为${statusLabel(parsed.data.status)}。`,
      meta: {
        itemCode: toCode(item.seq),
        itemTitle: item.title,
        status: parsed.data.status
      },
      itemId: item.id
    });
  }

  return res.json({ success: true, data: item });
});

app.post("/api/admin/items/batch-delete", requireAdmin, async (req: express.Request, res: express.Response) => {
  const parsed = adminItemBatchDeleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "参数不合法" });
  }
  const ids = parsed.data.ids;
  const items = await prisma.item.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, title: true }
  });
  if (items.length !== ids.length) {
    return res.status(400).json({ success: false, error: "存在无效物品" });
  }
  const invalid = items.find((item) => item.status !== "CLAIMED" && item.status !== "REMOVED");
  if (invalid) {
    return res.status(400).json({ success: false, error: `物品“${invalid.title}”状态不允许删除` });
  }

  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { itemId: { in: ids } } }),
    prisma.claim.deleteMany({ where: { itemId: { in: ids } } }),
    prisma.report.deleteMany({ where: { itemId: { in: ids } } }),
    prisma.item.deleteMany({ where: { id: { in: ids } } })
  ]);

  return res.json({ success: true, data: { deleted: ids.length } });
});

app.get("/api/admin/users", requireAdmin, async (req: express.Request, res: express.Response) => {
  const parsed = adminUserQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "参数不合法" });
  }
  const q = parsed.data.q?.trim();
  const where = q
    ? {
        OR: [
          { username: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { phone: { contains: q, mode: Prisma.QueryMode.insensitive } }
        ]
      }
    : {};
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, phone: true, createdAt: true }
  });
  return res.json({ success: true, data: users });
});

app.post("/api/admin/users", requireAdmin, async (req: express.Request, res: express.Response) => {
  const parsed = adminUserCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.length ? issue.path.join(".") : "字段";
    return res.status(400).json({ success: false, error: `${field}: ${issue?.message ?? "参数不合法"}` });
  }
  const exists = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
  if (exists) {
    return res.status(400).json({ success: false, error: "手机号已存在" });
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      username: parsed.data.username,
      phone: parsed.data.phone,
      passwordHash
    }
  });
  return res.json({ success: true, data: { id: user.id, username: user.username, phone: user.phone } });
});

app.patch("/api/admin/users/:id", requireAdmin, async (req: express.Request, res: express.Response) => {
  const parsed = adminUserUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.length ? issue.path.join(".") : "字段";
    return res.status(400).json({ success: false, error: `${field}: ${issue?.message ?? "参数不合法"}` });
  }
  const data: Record<string, unknown> = {};
  if (parsed.data.username) {
    data.username = parsed.data.username;
  }
  if (parsed.data.phone) {
    const exists = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
    if (exists && exists.id !== req.params.id) {
      return res.status(400).json({ success: false, error: "手机号已存在" });
    }
    data.phone = parsed.data.phone;
  }
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }
  const updated = await prisma.user.update({ where: { id: req.params.id }, data });

  if (parsed.data.phone) {
    const encrypted = encryptText(parsed.data.phone, config.encKey);
    const hint = maskContact(parsed.data.phone);
    await prisma.item.updateMany({
      where: { publisherId: updated.id },
      data: { publisherContact: encrypted, publisherHint: hint }
    });
    await prisma.claim.updateMany({
      where: { claimantId: updated.id },
      data: { claimantContact: encrypted }
    });
  }

  return res.json({ success: true, data: { id: updated.id, username: updated.username, phone: updated.phone } });
});

app.delete("/api/admin/users/:id", requireAdmin, async (req: express.Request, res: express.Response) => {
  const [items, claims, reports] = await Promise.all([
    prisma.item.count({ where: { publisherId: req.params.id } }),
    prisma.claim.count({ where: { claimantId: req.params.id } }),
    prisma.report.count({ where: { reporterId: req.params.id } })
  ]);
  if (items > 0 || claims > 0 || reports > 0) {
    return res.status(400).json({ success: false, error: "该用户已有数据，无法删除" });
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  return res.status(500).json({ success: false, error: "服务器错误" });
});

app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}`);
  const nets = os.networkInterfaces() as Record<string, os.NetworkInterfaceInfo[]>;
  const ips: string[] = [];
  Object.values(nets).forEach((iface) => {
    iface?.forEach((addr: os.NetworkInterfaceInfo) => {
      if (addr.family === "IPv4" && !addr.internal) {
        ips.push(addr.address);
      }
    });
  });
  if (ips.length > 0) {
    console.log("局域网访问地址:");
    ips.forEach((ip) => {
      console.log(`http://${ip}:3000`);
    });
  }
});
