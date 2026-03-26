import dotenv from "dotenv";

dotenv.config();

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  adminToken: required("ADMIN_TOKEN"),
  encKey: required("ENC_KEY"),
  jwtSecret: required("JWT_SECRET"),
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:4000",
  maxImageCount: 5,
  maxImageSizeMb: 15,
  itemExpireDays: Number(process.env.ITEM_EXPIRE_DAYS ?? 30),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production",
  cookieDomain: process.env.COOKIE_DOMAIN ?? undefined
};
