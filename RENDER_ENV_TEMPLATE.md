# Render 环境变量配置模板 - fanfanauto.top

## 后端服务 (zhenyuan-backend)

在 Render Dashboard → Your Service → Environment 添加：

```bash
# 必需变量（必须）
NODE_ENV=production
PORT=10000

# 数据库（从 Neon 复制）
DATABASE_URL=postgresql://username:password@ap-southeast-1.aws.neon.tech/zhenyuan_lostfound?sslmode=require

# 安全密钥（随机生成）
ADMIN_TOKEN=你的管理员令牌，如: a1b2c3d4e5f6a7b8
ENC_KEY=base64编码的32字节，如: gH9vN2qP5sL8xK3mB7tR4wZ6yA1cV9fJ0lM5nQ8w=
JWT_SECRET=随机字符串，如: x7y9z2a4b6c8d0e2f4g6h8j0k2m4n6p8r

# 应用配置
PUBLIC_BASE_URL=https://api.fanfanauto.top
CORS_ORIGIN=https://fanfanauto.top
COOKIE_SECURE=true
UPLOAD_DIR=uploads
ITEM_EXPIRE_DAYS=30

# 可选（如果还需要）
# COOKIE_DOMAIN=.fanfanauto.top
```

### 生成密钥命令（在你的电脑运行）：

```bash
# ENC_KEY (32 bytes base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# JWT_SECRET (随机 hex 字符串)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# ADMIN_TOKEN (随机 8 字节 hex)
node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"
```

## 前端服务 (zhenyuan-frontend)

在 Render Dashboard → Your Service → Environment 添加：

```bash
NODE_ENV=production
PORT=10000
NEXT_PUBLIC_API_URL=https://api.fanfanauto.top
```

## 配置检查

✅ `PUBLIC_BASE_URL` = `https://api.fanfanauto.top` (后端用)
✅ `NEXT_PUBLIC_API_URL` = `https://api.fanfanauto.top` (前端用)
✅ `CORS_ORIGIN` = `https://fanfanauto.top` (允许的源)
✅ `COOKIE_SECURE` = `true` (HTTPS 必须)

## 注意事项

1. **不要使用 localhost** - 所有 URL 必须使用你的域名
2. **COOKIE_SECURE 必须为 true** - 生产环境 HTTPS 需要
3. **COOKIE_DOMAIN** - 如果 cookie 不生效，添加 `.fanfanauto.top`（注意前导点）
4. **DATABASE_URL** - 必须来自 Neon，格式正确（包含 `?sslmode=require`）
5. **Renderer 会自动重启** - 修改环境变量后，服务会自动重新部署

## 验证配置

部署完成后，检查：

1. 后端日志应显示：
```
Applied X migrations
Database connected
API running on http://localhost:10000
```

2. 访问 `https://api.fanfanauto.top/api/health` 返回：
```json
{
  "success": true,
  "data": { "status": "ok" }
}
```

3. 前端页面加载，API 请求不出现 CORS 错误

## 问题排查

如果部署失败，查看 Render Logs:
- `Build failed` → 检查 `buildCommand` 是否正确
- `DATABASE_URL` 错误 → 检查 Neon 连接串格式
- `Prisma schema initialized from the database` 没出现 → migrate 失败
- `Error: Cannot find module` → 检查 `buildCommand` 的路径

---

**快速复制**: 上面的代码块可直接复制到 Render Environment 页面
