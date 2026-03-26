import { z } from "zod";

const phoneRegex = /^1\d{10}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const codeRegex = /^\d{5}$/;
const phoneSchema = z.string().regex(phoneRegex, "手机号格式不正确");
const contactSchema = z
  .string()
  .min(5)
  .max(80)
  .refine((value) => phoneRegex.test(value) || emailRegex.test(value), {
    message: "联系方式需为手机号或邮箱"
  });

export const registerSchema = z.object({
  username: z.string().min(1).max(20),
  phone: phoneSchema,
  password: z.string().min(1).max(50)
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(50)
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(50),
  newPassword: z.string().min(1).max(50)
});

export const createItemSchema = z.object({
  title: z.string().min(1).max(50),
  category: z.string().min(1).max(20),
  description: z.string().min(1),
  images: z.array(z.string().url()).min(1).max(5),
  foundAt: z.string().datetime(),
  locationText: z.string().min(1).max(100)
});

export const claimSchema = z.object({
  claimantName: z.string().min(1).max(20),
  claimantContact: phoneSchema,
  verificationInfo: z.string().min(1)
});

export const claimStatusUpdateSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "WITHDRAWN"])
});

export const reportSchema = z.object({
  itemCode: z.string().regex(codeRegex, "物品编号应为 5 位数字"),
  type: z.enum(["FAKE", "INAPPROPRIATE", "AD", "OTHER"]),
  note: z.string().max(200).optional().nullable()
});

export const itemQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  status: z.enum(["OPEN", "CLAIMING", "CLAIMED", "REMOVED"]).optional(),
  sort: z.enum(["latest", "views"]).optional(),
  timeRange: z.enum(["week", "month", "all"]).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional()
});

export const statusUpdateSchema = z.object({
  status: z.enum(["OPEN", "CLAIMING", "CLAIMED", "REMOVED"])
});

export const adminStatusUpdateSchema = z.object({
  status: z.enum(["OPEN", "CLAIMING", "CLAIMED", "REMOVED"])
});

export const adminUserCreateSchema = z.object({
  username: z.string().min(1).max(20),
  phone: phoneSchema,
  password: z.string().min(1).max(50)
});

export const adminUserUpdateSchema = z.object({
  username: z.string().min(1).max(20).optional(),
  phone: phoneSchema.optional(),
  password: z.string().min(1).max(50).optional()
});

export const adminUserQuerySchema = z.object({
  q: z.string().optional()
});

export const adminItemBatchDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1)
});
