# Neon PostgreSQL 迁移指南

本文档说明如何将你的 PostgreSQL 数据库从本地迁移到 Neon 云数据库。

## 为什么选择 Neon？

- **免费额度**: 每月 10 万行 SQL 操作 + 500MB 存储
- **自动扩容**: 无需担心空间不足
- **全球分布**: 支持多区域部署（AWS、GCP、Azure）
- **分支功能**: 可创建分支用于开发/测试
- **自动备份**: 时间点恢复（PITR）

## 迁移步骤

### 1. 注册并创建 Neon 项目

1. 访问 [neon.tech](https://neon.tech) 并注册账户（可用 GitHub 登录）
2. 创建新项目 (Create Project)
3. 项目名称: `zhenyuan-lostfound`
4. 选择离你用户最近的 **区域** (Region):
   - 推荐: `AWS - Singapore` (亚洲用户)
   - 或: `GCP - Taipei` (台湾)
   - 美国用户可选 `AWS - N. Virginia`
5. 点击 **Create Project**

### 2. 获取连接字符串 (Connection String)

创建项目后，Neon 会显示：

```
Connection string:
postgresql://username:password@your-neon-host.neon.tech/zhenyuan_lostfound?sslmode=require
```

**复制这个字符串**，稍后会用到。

同时，Neon 会自动创建数据库: `zhenyuan_lostfound`

### 3. 备份本地数据库（如果已有数据）

如果本地已有数据需要迁移：

```bash
# 备份本地 PostgreSQL
pg_dump -h localhost -U postgres -d zhenyuan_lostfound > backup.sql
```

### 4. 将本地数据库推送到 Neon

#### 方法 A: 使用 Prisma (推荐)

```bash
# 进入 backend 目录
cd backend

# 1. 更新 .env 文件，设置 DATABASE_URL 为 Neon 连接字符串
# 编辑 backend/.env，替换 DATABASE_URL= 为你的 Neon 连接串

# 2. 生成 Prisma Client
npm run prisma:generate

# 3. 创建迁移（如果是全新数据库，直接 migrate）
npm run prisma:migrate

# 4. 如果已有数据需要恢复，从 backup.sql 导入
psql "postgresql://username:password@your-neon-host.neon.tech/zhenyuan_lostfound?sslmode=require" < backup.sql

# 5. 填充种子数据
npm run seed
```

#### 方法 B: 使用 Neon SQL Editor

1. 进入 Neon Dashboard → 你的项目 → **SQL Editor**
2. 粘贴从 `backup.sql` 导出的 SQL 语句
3. 点击 **Run**

### 5. 更新 Render 环境变量

在 Render Dashboard 中，找到你的后端服务 (zhenyuan-backend)：

1. 进入 **Environment** 部分
2. 找到 `DATABASE_URL`：
   - 删除旧的本地连接
   - 添加 Neon 连接字符串
3. 确保其他变量已设置（参考 `backend/.env.production.example`）

**重要**: Render 会自动重新部署当环境变量变更时。

### 6. 验证连接

部署后，检查 Render 日志：

```bash
# 在 Render Dashboard → Logs 查看
# 应该看到:
Prisma schema initialized from the database
Applied X migrations
✅ Database connected
```

访问后端健康检查:
```
https://zhenyuan-backend.onrender.com/api/health
```

应返回：
```json
{
  "success": true,
  "data": { "status": "ok" }
}
```

### 7. 清理本地 Docker（可选）

迁移成功后，本地 Docker PostgreSQL 可停用：

```bash
# 停止容器
docker compose down

# 备份后删除数据（谨慎！）
docker volume ls | grep zhenyuan
# docker volume rm zhenyuan_lostfound_zhenyuan_pg
```

## 生产环境注意事项

### 1. 连接池管理

Neon 有连接数限制（免费版 20 连接）。Prisma 默认连接池较小，需检查：

```typescript
// backend/src/db.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  // 限制连接数，避免超过 Neon 配额
  datasourceUrl: process.env.DATABASE_URL,
  // max: 最大连接数（免费版建议 10）
  // 生产可调整为 10-15
});
```

### 2. 查询优化

Neon 按 **计算单元 (CU)** 计费（免费版 3-10 CU）。需优化：

- 添加索引（已在 schema 添加基本索引）
- 避免 N+1 查询（使用 Prisma `include`）
- 分页查询（已实现）

### 3. 自动终止空闲连接

免费版 Neon 自动终止空闲连接 > 5 分钟。Prisma 默认心跳 30 秒，没问题。

### 4. 使用分支（推荐用于开发）

Neon 支持分支，可为每个开发者创建独立数据库：

```bash
# 创建分支（在 Neon Dashboard）
Branch name: dev/alice
Branch of: main

# 获取分支连接串
postgresql://username:password@your-neon-host.neon.tech/zhenyuan_lostfound?branch=dev%2Falice&sslmode=require
```

### 5. 监控使用量

在 Neon Dashboard：

1. **Usage** → 查看：
   - Data usage (存储)
   - SQL transactions (操作数)
   - Active connections (连接数)
   - Compute (CU)

2. 设置 **Billing alerts**：
   - 免费额度 80% 时发送邮件
   - 避免意外超支

### 6. 备份与恢复

Neon 自动备份（免费版保留 1 天，付费版 7-90 天）。

手动创建 Branch 作为快照：
```
Branch from: main
Branch name: backup/2025-01-15
```

恢复数据：
```sql
-- 回滚到特定时间点（需付费方案）
-- 免费版只能从 Branch 恢复
```

### 7. 区域选择

Neon 支持多区域：
- **Asia 用户**: AWS Singapore / GCP Taipei
- **US 用户**: AWS N. Virginia / Oregon
- **Europe 用户**: AWS Frankfurt / London

**重要**: 创建后无法更改区域，如需迁移需新建项目。

### 8. 迁移后验证

部署后运行以下查询验证：

```sql
-- 检查表数量
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';

-- 检查数据行数
SELECT 'users' as table_name, COUNT(*) FROM "User"
UNION ALL
SELECT 'items', COUNT(*) FROM "Item"
UNION ALL
SELECT 'claims', COUNT(*) FROM "Claim"
UNION ALL
SELECT 'reports', COUNT(*) FROM "Report"
UNION ALL
SELECT 'notifications', COUNT(*) FROM "Notification";
```

### 9. 常见迁移问题

#### 问题 1: `relation "User" does not exist`
**原因**: Prisma 大写模型名映射到不同表名。Neon 默认小写。
**解决**: 在 `schema.prisma` 确保：
```prisma
model User {
  // ...
}
```
表名会生成为 `User`（大写）。如果已存在小写表名，需使用 `@@map`:
```prisma
model User {
  // ...
  @@map("users")
}
```

#### 问题 2: 连接超时
**原因**: Neon 连接数满或网络延迟
**解决**:
1. 检查 `prisma` 连接池配置
2. 确保 Render 与 Neon 同区域（如都选 AWS Singapore）
3. 启用 Neon **Connection pooling** (在 Dashboard → Connection Pool)

#### 问题 3: `sslmode` 错误
**错误**: `SSLError: certificate verify failed`
**解决**: 连接串必须包含 `?sslmode=require`，Neon 强制 SSL。

#### 问题 4: seed 数据重复
**错误**: `Unique constraint failed`
**解决**: 修改 `prisma/seed.js`，先 `deleteMany` 再 `create`，或使用 `upsert`。

### 10. 性能调优

1. **添加缺失索引**:
```prisma
model Item {
  // ...
  @@index([title])  // 搜索优化
  @@map("items")
}
```

2. **使用 `EXPLAIN ANALYZE`**:
```sql
EXPLAIN ANALYZE SELECT * FROM "Item" WHERE status = 'OPEN';
```

3. **启用 Neon 的 Branch Autosuspend**:
   - 免费版默认启用，无访问自动休眠

### 11. 安全建议

1. **不要将连接串硬编码**：始终使用环境变量
2. **限制连接 IP**：在 Neon 设置 IP 允许列表（可选）
3. **使用只读用户**：为只读操作创建单独用户
4. **定期审计**: 查看 Neon 的 **Query Log**

### 12. 成本控制

- **免费额度**: 10 万次 SQL 操作/月，500MB 存储
- **监控**: 设置月度警报（80% 额度时）
- **优化**: 避免全表扫描，合理使用索引
- **分支策略**: 删除不用的分支节省存储

---

## 快速检查清单

- [ ] 在 Neon 创建项目
- [ ] 获取连接字符串
- [ ] 更新 Render `DATABASE_URL` 环境变量
- [ ] 运行 `npm run prisma:generate`
- [ ] 运行 `npm run prisma:migrate`
- [ ] 运行 `npm run seed`
- [ ] 验证 Render 部署成功
- [ ] 测试 API 端点
- [ ] 配置 Neon 监控和警报

---

**下一步**: 参考 `CLOUDFLARE.md` 配置 CDN，或查看 `README.md` 更新部署文档。
