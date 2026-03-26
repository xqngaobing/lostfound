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
