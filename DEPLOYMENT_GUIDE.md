# 🎯 fanfanauto.top 部署实践指南

你的域名: `fanfanauto.top` (已托管在 Cloudflare)
目标: 部署失物招领平台到生产环境

## 部署架构

```
用户访问 → Cloudflare (CDN + 安全) → Render (前后端) → Neon DB
    │              ↗                    ↗
    └── fanfanauto.top      zhenyuan-backend/render.com
```

## 步骤 1: Neon 数据库（5 分钟）

1. 访问 https://neon.tech/ 注册（GitHub 登录）
2. 点击 **Create Project**
   - **Name**: `zhenyuan-lostfound`
   - **Region**: 选择 **AWS Singapore**（亚洲用户最快）
3. 等待创建完成（约 30 秒）
4. 复制 **Connection string**（类似）:
   ```
   postgresql://alice:xxxx@ap-southeast-1.aws.neon.tech/zhenyuan_lostfound?sslmode=require
   ```
5. **保留此连接串**（待会用）

## 步骤 2: Render 部署（10 分钟）

### 2.1 后端服务 (zhenyuan-backend)

1. 登录 https://dashboard.render.com/
2. 点击 **New +** → **Web Service**
3. 连接 GitHub 仓库，选择 `zhenyuan-lostfound`
4. 配置：

| 字段 | 值 |
|-----|-----|
| **Name** | `zhenyuan-backend` |
| **Environment** | `Node` |
| **Build Command** | `cd backend && npm ci --only=production && npm run prisma:generate && npm run prisma:migrate` |
| **Start Command** | `cd backend && npm start` |
| **Plan** | `Free` |

5. **Environment Variables** (添加以下变量):

| Key | Value | 说明 |
|-----|-------|------|
| `NODE_ENV` | `production` | 固定 |
| `PORT` | `10000` | Render 要求 |
| `DATABASE_URL` | `[粘贴 Neon 连接串]` | **必填** |
| `ADMIN_TOKEN` | `[随机生成]` | 管理后台密码 |
| `ENC_KEY` | `[随机生成]` | 32字节 base64 |
| `JWT_SECRET` | `[随机生成]` | JWT 签名密钥 |
| `PUBLIC_BASE_URL` | `https://api.fanfanauto.top` | **重要** |
| `CORS_ORIGIN` | `https://fanfanauto.top` | 前端域名 |
| `COOKIE_SECURE` | `true` | 生产必须 |
| `UPLOAD_DIR` | `uploads` | 固定 |
| `ITEM_EXPIRE_DAYS` | `30` | 固定 |

**生成随机密钥**（在你的电脑运行）:
```bash
# 生成 32 字节 base64 (ENC_KEY)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 生成随机字符串 (JWT_SECRET)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# 生成随机管理员令牌
node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"
```

6. 点击 **Create Web Service**
7. 等待首次部署（3-5 分钟）
8. 检查日志：确认 `Prisma schema initialized` 和 `Database connected`

### 2.2 前端服务 (zhenyuan-frontend)

重复上述步骤：

1. **New +** → **Web Service**
2. 连接同一仓库

| 字段 | 值 |
|-----|-----|
| **Name** | `zhenyuan-frontend` |
| **Environment** | `Node` |
| **Build Command** | `cd frontend && npm ci && npm run build` |
| **Start Command** | `cd frontend && npm start` |
| **Plan** | `Free` |

3. **Environment Variables**:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `NEXT_PUBLIC_API_URL` | `https://api.fanfanauto.top` |

4. 点击 **Create Web Service**
5. 等待部署完成（约 2-3 分钟）

## 步骤 3: Cloudflare 配置（10 分钟）

你的域名已托管在 Cloudflare，只需添加 DNS 记录。

### 3.1 添加 CNAME 记录

进入 Cloudflare Dashboard → `fanfanauto.top` → **DNS** → **Add record**：

#### 记录 A: 前端（根域名）

```
Type: CNAME
Name: @  (或留空，表示根域名 fanfanauto.top)
Target: zhenyuan-frontend.onrender.com
Proxy status: ✅ Proxied (橙色云)
TTL: Auto
```

#### 记录 B: 后端 API（子域名）

```
Type: CNAME
Name: api
Target: zhenyuan-backend.onrender.com
Proxy status: ✅ Proxied (橙色云)
TTL: Auto
```

**效果**:
- `https://fanfanauto.top` → 前端
- `https://api.fanfanauto.top` → 后端

### 3.2 配置 SSL/TLS

1. **SSL/TLS** → **Overview** → 选择 **Full (strict)**
2. **SSL/TLS** → **Edge Certificates**:
   - ✅ **Always Use HTTPS**
   - ✅ **Automatic HTTPS Rewrites**
   - ✅ **Minimum TLS Version**: TLS 1.2
   - ✅ **TLS 1.3**

### 3.3 配置 Page Rules

进入 **Rules** → **Page Rules** → **Add a rule**：

#### Rule 1: 缓存 Next.js 静态资源

```
URL: https://fanfanauto.top/_next/static/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 year
  - Browser Cache TTL: 1 year
  - Bypass Cache on Cookie: OFF
```

#### Rule 2: API 请求不缓存

```
URL: https://fanfanauto.top/api/*
Settings:
  - Disable Performance
  - Disable Security (可选，如果 API 被 WAF 拦截)
```

#### Rule 3: 强制 HTTPS 重定向

```
URL: http://fanfanauto.top/*
Settings:
  - Forwarding URL (301): https://fanfanauto.top/$1
```

#### Rule 4: API 强制 HTTPS

```
URL: http://api.fanfanauto.top/*
Settings:
  - Forwarding URL (301): https://api.fanfanauto.top/$1
```

### 3.4 配置 Security Headers（推荐）

进入 **Security** → **Settings** → 开启:

- ✅ **Email Address Obfuscation**
- ✅ **Bot Fight Mode**
- ✅ ** integrity check**

### 3.5 配置缓存（Caching）

进入 **Caching** → **Configuration**:

```
Browser Cache TTL: 4 hours
Always Online: ON (推荐)
```

### 3.6 DNS 传播检查

等待 5-10 分钟后，验证 DNS 生效：

```bash
# 查询 DNS
nslookup fanfanauto.top
nslookup api.fanfanauto.top

# 或使用在线工具: https://dnschecker.org
```

应该看到 CNAME 指向 `.onrender.com`

## 步骤 4: 验证部署（5 分钟）

### 4.1 检查 Render 服务状态

访问：
```
https://zhenyuan-backend.onrender.com/api/health
```
预期返回：`{"success":true,"data":{"status":"ok"}}`

访问：
```
https://zhenyuan-frontend.onrender.com
```
预期显示：Next.js 首页

### 4.2 测试自定义域名

访问：
```
https://fanfanauto.top
```
预期显示：相同的 Next.js 首页（通过 Cloudflare CDN）

访问：
```
https://api.fanfanauto.top/api/health
```
预期返回：`{"success":true,"data":{"status":"ok"}}`

**注意**: 首次访问 Cloudflare 可能稍慢（DNS 解析），后续会加速。

### 4.3 测试完整流程

1. 访问 `https://fanfanauto.top` → 前端页面加载
2. 点击注册 → 填写信息提交
3. 发布物品 → 上传图片
4. 退出登录 → 再次登录
5. 查看管理后台 → `https://fanfanauto.top/admin`（需输入 ADMIN_TOKEN）

### 4.4 检查图片上传

1. 发布物品并上传图片
2. 查看物品详情，图片 URL 应该是：
   ```
   https://api.fanfanauto.top/uploads/xxx.webp
   ```
   而不是 `localhost` 或 `.onrender.com`

如果图片显示 `localhost`，检查：
- 后端 `PUBLIC_BASE_URL` 是否设为 `https://api.fanfanauto.top`
- 重启后端服务（ Render → Manual Deploy）

## 步骤 5: 生产优化（可选）

### 5.1 启用 Render Background Worker

如果需要处理异步任务（邮件通知等）：
1. 创建 **Background Worker**
2. Build Command: `cd backend && npm ci --only=production`
3. Start Command: `cd backend && npm run worker`（需自己实现）

### 5.2 升级 Render 配置

如果免费版不够用：
- **后端**: 升级到 $7/月（512MB → 1GB, 无休眠警告）
- **前端**: 保持免费或升级 $5/月（更多 build minutes）

### 5.3 配置 Uptime 监控

推荐 UptimeRobot (免费):
1. 注册 https://uptimerobot.com/
2. Add Monitor → **HTTP(s)**
3. URL: `https://api.fanfanauto.top/api/health`
4. Check interval: 5 minutes
5. 设置邮件/Telegram 通知

**注意**: 频繁 ping 可能违反 Render 免费政策，建议 5-15 分钟一次。

### 5.4 添加 Google Analytics

在 `frontend/app/layout.tsx` 添加 GA 代码（略）。

## 故障排除

### 问题 1: 502 Bad Gateway

**原因**: 后端未启动或崩溃
**解决**:
1. 检查 Render Logs → 查看错误信息
2. 确保环境变量 `DATABASE_URL` 正确
3. 确保 `npm run prisma:migrate` 成功

### 问题 2: 404 Not Found (API)

**原因**: API 路径错误
**解决**:
1. 确认 `NEXT_PUBLIC_API_URL` 指向 `https://api.fanfanauto.top`
2. 浏览器 F12 → Network → 查看请求 URL
3. Cloudflare Page Rules 是否误拦截 `/api/*`

### 问题 3: 图片无法上传/显示

**原因**: 上传目录权限或 URL 错误
**解决**:
1. 检查 Render 是否允许写入（免费版有临时存储）
2. 检查 `PUBLIC_BASE_URL` 配置
3. 查看图片 URL 是否正确（应显示你的域名）

**注意**: Render 免费版文件系统是 **ephemeral**（重启丢失）。图片需要：
- 使用外部存储（如 Cloudflare R2、AWS S3）— 未来功能
- 或接受重启后图片丢失（数据在 DB 有记录，但文件丢失需重新上传）

### 问题 4: CORS 错误

**原因**: 后端 `CORS_ORIGIN` 不匹配
**解决**:
1. 确保 `CORS_ORIGIN=https://fanfanauto.top`（无 trailing slash）
2. 重启后端服务

### 问题 5: Cookie 不生效

**原因**: `COOKIE_DOMAIN` 未设置或域名不匹配
**解决**:
1. 设置 `COOKIE_DOMAIN=.fanfanauto.top`（注意前导点）
2. 确保 `COOKIE_SECURE=true`
3. 清除浏览器 cookie 后重试

### 问题 6: 数据库连接失败

**原因**: Neon 连接串错误或 SSL 问题
**解决**:
1. 确保 `DATABASE_URL` 包含 `?sslmode=require`
2. 检查 Neon 是否已启用（Dashboard → Branches → main 状态为 `Active`）
3. Neon 免费版有 20 连接限制，确保不超过

### 问题 7: Prisma 迁移失败

**错误**: `P3005` 或 `P3000`
**解决**:
1. 删除数据库重新创建（Neon Dashboard → **Drop Database**）
2. 重新部署 Render（会自动 migrate）
3. 或手动运行 `prisma migrate reset --force`

### 问题 8: Cloudflare 缓存问题

**症状**: 修改后页面不更新
**解决**:
1. 进入 Cloudflare **Caching** → **Configuration**
2. 点击 **Custom Purge** → Purge Everything
3. 或临时开启 **Development Mode**（1 小时 bypass 缓存）

## 成本预算（月）

| 服务 | 套餐 | 成本 |
|-----|------|-----|
| Neon | Free (10万 SQL, 500MB) | $0 |
| Render (Backend) | Free (768MB, 休眠) | $0 |
| Render (Frontend) | Free (静态托管) | $0 |
| Cloudflare | Free (CDN + SSL) | $0 |
| **总计** | | **$0** |

**注意**: 
- Render 免费版每天有 750 小时限额（2 个服务 × 24h = 48h/天，远低于限额）
- 但 **15 分钟无访问会休眠**，首次访问慢
- 可用 UptimeRobot 每 15 分钟 ping 一次保持活跃（有封号风险，谨慎）

## 后续优化建议

1. **持久化存储**: Render 文件系统不持久，需迁移到 R2/S3
2. **邮件通知**: 添加 Resend/SendGrid 发送邮件
3. **错误监控**: 添加 Sentry
4. **性能监控**: 添加 Vercel Analytics 或 Plausible
5. **SEO**: 完善 meta tags，提交 sitemap 到 Google
6. **备份策略**: 定期导出 Neon 数据到本地或 R2

## 紧急联系

- Render Status: https://status.render.com/
- Neon Status: https://neon.tech/status/
- Cloudflare Status: https://www.cloudflarestatus.com/

---

## 快速检查清单

```
✅ Neon 项目创建完成，复制连接串
✅ Render 后端服务创建，环境变量配置完整
✅ Render 前端服务创建，环境变量配置完整
✅ Cloudflare DNS CNAME 记录添加完成（2条）
✅ Cloudflare SSL/TLS 设置为 Full (strict)
✅ Cloudflare Page Rules 配置完成（至少2条）
✅ 访问 fanfanauto.top 显示前端页面
✅ 访问 api.fanfanauto.top/api/health 返回 ok
✅ 测试注册登录流程正常
✅ 图片上传和显示正常
✅ 管理后台可访问（/admin）
```

全部完成后，你的失物招领平台就在 `https://fanfanauto.top` 正式上线啦！🎉
