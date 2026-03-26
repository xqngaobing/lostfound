# 🚀 快速启动 - fanfanauto.top

这是你的私有部署速查表。按顺序执行即可。

---

## 📋 准备清单

- [ ] GitHub 仓库有完整代码（frontend/ + backend/）
- [ ] 已注册 https://neon.tech 账户
- [ ] 已注册 https://render.com 账户
- [ ] 已登录 https://dashboard.cloudflare.com
- [ ] 域名 `fanfanauto.top` 已在 Cloudflare

---

## ⚡ 5 分钟快速部署

### ① Neon 数据库 (2分钟)

1. 打开 https://neon.tech/ 新建项目
2. 名称: `zhenyuan-lostfound`
3. 区域: `AWS Singapore` (或其他离你近的)
4. 复制连接串（以 `postgresql://` 开头）
5. 粘贴到 `RENDER_ENV_TEMPLATE.md` 的 `DATABASE_URL` 位置备用

### ② Render 后端 (2分钟)

1. 打开 https://dashboard.render.com/ → New + → Web Service
2. 连接你的 GitHub 仓库
3. 配置：
   - Name: `zhenyuan-backend`
   - Build Command: `cd backend && npm ci --only=production && npm run prisma:generate && npm run prisma:migrate`
   - Start Command: `cd backend && npm start`
   - Environment: Node
4. **添加环境变量**（一次性复制下面的完整列表）:

```bash
NODE_ENV=production
PORT=10000
DATABASE_URL=粘贴你的Neon连接串
ADMIN_TOKEN=用随机生成器生成
ENC_KEY=用随机生成器生成
JWT_SECRET=用随机生成器生成
PUBLIC_BASE_URL=https://api.fanfanauto.top
CORS_ORIGIN=https://fanfanauto.top
COOKIE_SECURE=true
UPLOAD_DIR=uploads
ITEM_EXPIRE_DAYS=30
```

5. Create → 等待 3-5 分钟部署完成
6. 查看 Logs，确认无错误

### ③ Render 前端 (2分钟)

重复步骤 ②：

1. **New +** → **Web Service**
2. 连接同一仓库
3. 配置：
   - Name: `zhenyuan-frontend`
   - Build Command: `cd frontend && npm ci && npm run build`
   - Start Command: `cd frontend && npm start`
4. **环境变量**:

```bash
NODE_ENV=production
PORT=10000
NEXT_PUBLIC_API_URL=https://api.fanfanauto.top
```

5. Create → 等待 2-3 分钟

### ④ Cloudflare DNS (1分钟)

1. 打开 https://dashboard.cloudflare.com → `fanfanauto.top` → **DNS**
2. 添加 **CNAME** 记录：

```
Type: CNAME
Name: @
Target: zhenyuan-frontend.onrender.com
Proxy: Proxied (橙色云)
```

```
Type: CNAME
Name: api
Target: zhenyuan-backend.onrender.com
Proxy: Proxied (橙色云)
```

3. 保存

### ⑤ Cloudflare Page Rules (2分钟)

**Rules** → **Page Rules** → 按顺序添加：

1. `http://fanfanauto.top/*` → Forwarding 301 → `https://fanfanauto.top/$1`
2. `http://api.fanfanauto.top/*` → Forwarding 301 → `https://api.fanfanauto.top/$1`
3. `https://fanfanauto.top/_next/static/*` → Cache Everything (Edge TTL: 1 year)
4. `https://fanfanauto.top/api/*` → Disable Performance

---

## ✅ 即时验证

等待 10 分钟后（DNS 传播），打开浏览器：

### 测试 1: 前端

```
https://fanfanauto.top
```

✅ 应显示 Next.js 页面，无证书警告

### 测试 2: 后端健康

```
https://api.fanfanauto.top/api/health
```

✅ 应返回：`{"success":true,"data":{"status":"ok"}}`

### 测试 3: 注册流程

1. 访问 `https://fanfanauto.top`
2. 点击注册，填写手机号+密码
3. 成功跳转后，查看地址栏无错误

**如失败，按 F12 查看 Console 和 Network 标签**，常见问题：

- **CORS 错误** → 检查 `CORS_ORIGIN` 是否为 `https://fanfanauto.top`
- **401 未授权** → Cookie 未设置，检查 `COOKIE_SECURE=true`
- **连接拒绝** → 后端未启动，检查 Render Logs

---

## 🔧 常见问题

### 图片无法显示？

**原因**: `PUBLIC_BASE_URL` 不对或图片文件丢失

**检查**:
1. 打开 Network 标签，看图片 URL 是什么
2. 如果显示 `http://localhost:4000/...` → 后端配置错误
3. 如果显示 `https://api.fanfanauto.top/uploads/...` 但 404 → Render 文件系统已清空（重启后上传文件会丢失）

**临时解决**: 重新发布物品并上传图片
**永久解决**: 未来需用 R2/S3 云存储

### Footer 403 Forbidden？

**原因**: Cloudflare WAF 拦截 POST 请求

**解决**: Rules → Page Rules → 编辑 `/api/*` 规则，勾选 **Disable Security**

### 502 Bad Gateway？

**原因**: Render 后端崩溃

**解决**: 打开 Render 后端服务 → Logs
- 看是否有 `Error: DATABASE_URL` → 连接串错误
- 看是否有 `P3002` → 数据库未连接

### 首次访问很慢？

**原因**: Render 免费版 15 分钟休眠

**正常**: 第一次唤醒需 10-30 秒，之后快

**保持活跃**: 用 UptimeRobot 每 12 小时 ping 一次（有风险）或升级 $7/月

---

## 📁 已创建的文件

| 文件 | 用途 | 必读 |
|-----|------|------|
| `DEPLOYMENT_GUIDE.md` | 完整部署指南 | ✅ |
| `CLOUDFLARE_FANFANAUTO.md` | Cloudflare 具体配置 | ✅ |
| `RENDER_ENV_TEMPLATE.md` | Render 环境变量模板 | ✅ |
| `NEON_MIGRATION.md` | Neon 迁移教程 | ⚠️ |
| `CLOUDFLARE.md` | 通用 Cloudflare 指南 | ⚠️ |
| `backend/.env.production.example` | 后端环境变量示例 | ✅ |

---

## 需要修改的代码

✅ **已修改**: `frontend/app/_lib/api.ts` 使用 `NEXT_PUBLIC_API_URL`
✅ **已修改**: `frontend/next.config.js` 支持环境变量

**无需**再修改代码，直接把环境变量配置好就行。

---

## 🎯 下一步

1. **测试所有功能**:
   - [ ] 注册/登录
   - [ ] 发布物品（带图）
   - [ ] 查看物品详情
   - [ ] 提交认领申请
   - [ ] 管理后台 `/admin`

2. **设置监控** (可选):
   - UptimeRobot: 监控 `https://api.fanfanauto.top/api/health`
   - 设置邮件通知

3. **备份数据** (可选):
   - Neon Dashboard → Branches → 创建定期备份分支
   - 每周导出 SQL 备份到本地

4. **准备应急方案** (可选):
   - 记录 `neon.tech` 项目 ID
   - 记录 Render 服务名称
   - 准备备用域名

---

## 💡 省钱技巧

- **保持免费**: Neon + Render + Cloudflare 都是免费
- **避免休眠**: 升级 Render 到 $7/月，或接受 15 分钟首次访问慢
- **优化图片**: 使用 Cloudflare Polish（付费）或 WebP 压缩
- **限制存储**: 定期清理过期物品，保持 Neon 存储 < 500MB

---

## 🆘 紧急求助

**服务无法访问**:
1. 检查 Render Dashboard → Services 状态 (绿色?)
2. 检查 Logs 是否有错误
3. 检查 Cloudflare DNS 是否生效

**数据库连接失败**:
1. Neon Dashboard → Connection pool 是否满？
2. 复制新的连接串，更新 Render `DATABASE_URL`
3. 重启 Render 服务

**SSL 证书错误**:
1. Cloudflare SSL/TLS → Full (strict)
2. 等待 5 分钟证书生效
3. Purge Cache

---

**Done!** 按以上步骤，你的平台 20 分钟内应该能上线。遇到问题先看 Logs，大部分是配置错误。
