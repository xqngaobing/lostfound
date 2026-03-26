# 贞元学校失物招领平台

本项目包含前端（Next.js）+ 后端（Express）+ PostgreSQL。适用于校园内部失物招领场景。

## 目录结构

- `frontend` 前端站点
- `backend` 后端 API
- `docker-compose.yml` 本地 PostgreSQL

## 启动步骤

### 一键启动

双击根目录的 `start.bat`，会自动：
- 安装前后端依赖
- 启动 PostgreSQL（docker compose）
- 启动后端与前端开发服务

如果你已经安装过依赖，想跳过安装，可运行：

```bash
powershell -ExecutionPolicy Bypass -File start.ps1 -SkipInstall
```

---

1. 启动数据库

```bash
docker compose up -d
```

2. 配置后端环境变量

复制 `backend/.env.example` 为 `backend/.env`，并生成加密密钥。

```bash
# 生成 32 字节 base64 密钥
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

3. 安装后端依赖并初始化数据库

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

4. 安装前端依赖并启动

```bash
cd frontend
npm install
npm run dev
```

前端默认地址：`http://localhost:3000`
后端默认地址：`http://localhost:4000`

## 管理后台访问

在 `backend/.env` 设置 `ADMIN_TOKEN`，进入前端 `/admin` 页面输入该口令即可查看管理后台。

## 说明

- 发布信息时需填写手机号或邮箱，系统加密存储，不会公开展示。
- 发布成功后会生成管理码，用于查看认领申请、更新状态。

---

## 📦 生产环境部署

本项目已配置好云端部署方案，使用 **免费** 服务：

- **数据库**: [Neon PostgreSQL](https://neon.tech) (免费版: 10 万操作/月, 500MB 存储)
- **后端 API**: [Render](https://render.com) (免费版: 768MB RAM, 有休眠)
- **前端**: [Render](https://render.com) (免费版: 静态托管)
- **CDN/WAF**: [Cloudflare](https://cloudflare.com) (免费版)

### 部署前准备

1. 确保本地所有更改已提交
2. 确保 `git push` 到 GitHub/GitLab 等远程仓库

### 步骤 1: 配置 Neon 数据库

1. 注册 [Neon](https://neon.tech)（可用 GitHub 登录）
2. 创建项目:
   - 名称: `zhenyuan-lostfound`
   - 区域: 选择离用户最近的（如 `AWS Singapore`）
3. 复制连接串:
   ```
   postgresql://username:password@your-neon-host.neon.tech/zhenyuan_lostfound?sslmode=require
   ```
4. 详细迁移步骤见: [`NEON_MIGRATION.md`](./NEON_MIGRATION.md)

### 步骤 2: 配置 Render 部署

1. 注册 [Render](https://render.com)（可用 GitHub 登录）
2. 创建 **Web Service**（后端）:
   - 名称: `zhenyuan-backend`
   - 环境: Node
   - Build Command: `cd backend && npm ci --only=production && npm run prisma:generate && npm run prisma:migrate`
   - Start Command: `cd backend && npm start`
   - 环境变量: 参考 `backend/.env.production.example`
     - 关键变量:
       ```bash
       DATABASE_URL=你的Neon连接串
       ADMIN_TOKEN=随机字符串
       ENC_KEY=base64编码的32字节密钥（可用 `openssl rand -base64 32` 生成）
       JWT_SECRET=随机字符串
       PUBLIC_BASE_URL=https://zhenyuan-backend.onrender.com
       CORS_ORIGIN=https://zhenyuan-frontend.onrender.com
       COOKIE_SECURE=true
       ```
3. 创建 **Web Service**（前端）:
   - 名称: `zhenyuan-frontend`
   - 环境: Node
   - Build Command: `cd frontend && npm ci && npm run build`
   - Start Command: `cd frontend && npm start`
   - 环境变量:
     ```bash
     NODE_ENV=production
     NEXT_PUBLIC_API_URL=https://zhenyuan-backend.onrender.com
     ```
4. 等待部署完成（首次约 3-5 分钟）

### 步骤 3: 配置 Cloudflare（可选但推荐）

1. 注册 [Cloudflare](https://cloudflare.com)
2. 添加你的域名
3. 修改域名注册商的 Nameservers 为 Cloudflare 提供
4. 配置 DNS 记录（CNAME 指向 Render 域名）
5. 开启 SSL/TLS (Full strict)
6. 详细步骤见: [`CLOUDFLARE.md`](./CLOUDFLARE.md)

**注意**: 如果使用 Cloudflare，需要更新 Render 环境变量:
- `PUBLIC_BASE_URL=https://api.your-domain.com`
- `NEXT_PUBLIC_API_URL=https://api.your-domain.com`

### 步骤 4: 验证部署

1. 访问后端健康检查:
   ```
   https://zhenyuan-backend.onrender.com/api/health
   ```
2. 访问前端首页:
   ```
   https://zhenyuan-frontend.onrender.com
   ```
3. 测试注册、登录、发布物品流程
4. 访问管理后台: `/admin` (需 ADMIN_TOKEN)

### 常见问题

**后端启动失败**:
- 检查环境变量是否齐全
- 查看 Render Logs: 是否 `prisma migrate` 成功
- 确保 `DATABASE_URL` 正确且包含 `?sslmode=require`

**前端无法访问 API**:
- 检查 `NEXT_PUBLIC_API_URL` 是否指向正确的后端 URL
- 检查 CORS_ORIGIN 是否匹配前端域名

**图片无法显示**:
- 检查 `PUBLIC_BASE_URL` 配置
- 图片 URL 应使用后端域名（如果使用 Cloudflare，应使用自定义域名）

**免费版休眠**:
- Render 免费 Web Service 15 分钟无访问会休眠
- 首次访问会较慢（10-30 秒）
- 可用 UptimeRobot 等监控服务每小时 ping 一次保持活跃（有被禁用风险）

### 预算与成本

- **Neon**: 免费版足够小规模使用（<1000 用户）
- **Render**: 免费版，有休眠和限制
- **Cloudflare**: 免费版，无限制

如果需求增长，可考虑:
- Render 付费 ($7/月): 无休眠，更多资源
- Neon 付费 ($19/月): 更多计算单元和存储

### 维护

- **数据库备份**: Neon 自动备份，免费版保留 1 天
- **日志查看**: Render Dashboard → Logs
- **错误监控**: 可集成 Sentry/LogRocket（需自行添加）
- **SSL 证书**: Cloudflare/Render 自动管理，无需手动更新

---

## 📚 相关文档

- [本地开发启动](./README.md#启动步骤) - 本地开发环境配置
- [Neon 迁移指南](./NEON_MIGRATION.md) - 数据库迁移详细步骤
- [Cloudflare 配置](./CLOUDFLARE.md) - CDN 和安全配置
- [backend/README.md](./backend/README.md) - 后端 API 文档（如有）
