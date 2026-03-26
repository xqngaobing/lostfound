# Cloudflare 配置指南

本文档说明如何使用 Cloudflare 为你的失物招领平台提供 CDN 加速和安全保护。

## 前置条件

1. 已在 Cloudflare 注册账户
2. 已拥有域名（如 `your-domain.com`）
3. 已在 Render 上部署完成获得后端和前端 URL

## 配置步骤

### 1. 添加站点到 Cloudflare

1. 登录 Cloudflare Dashboard
2. 点击 "Add a Site"
3. 输入你的域名
4. 选择免费套餐 (Free)
5. Cloudflare 会扫描现有 DNS 记录

### 2. 更新域名服务器 (Nameservers)

Cloudflare 会提供 2 个 nameservers:
- `xxx.ns.cloudflare.com`
- `yyy.ns.cloudflare.com`

**重要**: 需要到你的域名注册商（如 GoDaddy、Namecheap 等）将域名的 nameservers 替换为 Cloudflare 提供的这两个。

**注意**: DNS 传播可能需要 24-48 小时。

### 3. 配置 DNS 记录

在 Cloudflare DNS 页面，确保有以下记录（添加或修改）：

#### A 记录（如果直接指向 Render IP）

```
类型: A
名称: @ (或你的域名)
IPv4: [你的 Render 后端 IP 地址]
代理状态: 橙色云 (已代理)
```

#### CNAME 记录（推荐，使用 Render 提供的域名）

```
类型: CNAME
名称: api
目标: zhenyuan-backend.onrender.com
代理状态: 橙色云 (已代理)
```

```
类型: CNAME
名称: www (或前端子域名)
目标: zhenyuan-frontend.onrender.com
代理状态: 橙色云 (已代理)
```

**橙色云**表示流量经过 Cloudflare 代理（CDN + 安全保护）
**灰色云**表示 DNS only（不经过 Cloudflare 代理）

### 4. 配置 SSL/TLS

1. 进入 **SSL/TLS** → **Overview**
2. 选择 **Full (strict)** 模式（推荐）
   - 此模式会验证 Render 的 SSL 证书
   - Render 已自动提供 SSL 证书

3. 进入 **SSL/TLS** → **Edge Certificates**
   - 确保 **Always Use HTTPS** 为 ON
   - 确保 **Automatic HTTPS Rewrites** 为 ON

### 5. 配置 Page Rules（可选但推荐）

进入 **Rules** → **Page Rules** 添加以下规则：

#### 规则 1: 缓存静态资源（前端）

```
URL: zhenyuan-frontend.onrender.com/_next/static/*
设置:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 year
  - Browser Cache TTL: 1 year
  - Bypass Cache on Cookie: No
```

#### 规则 2: 不上传接口的缓存

```
URL: zhenyuan-frontend.onrender.com/api/*
设置:
  - Disable Performance
  - Disable Security
```

#### 规则 3: 强制 HTTPS 重定向

```
URL: http://zhenyuan-backend.onrender.com/*
设置:
  - Forwarding URL (301/302): https://zhenyuan-backend.onrender.com/$1
```

#### 规则 4: 保护上传接口

```
URL: zhenyuan-backend.onrender.com/api/uploads
设置:
  - Security Level: High
  - Disable Speed Brain: No
```

### 6. 配置防火墙规则（可选）

进入 **Security** → **WAF** → **Managed rules**：

- **Sensitivity**: Medium
- **Action**:默认 **Log**，可对严重威胁设为 **Block**

或创建自定义规则：

进入 **Security** → **WAF** → **Custom rules**：

```
规则名称: Rate Limit API
当 所有请求 满足以下条件:
  - URI 包含 "/api/"
  - HTTP 方法 为 POST
执行:
  - Rate limit: 10 requests per minute
动作: Block
```

### 7. 配置网络（Network）

进入 **Network** 页面：

- **IP Access Rules**: 可按需限制特定 IP 访问
- **IP Geolocation**: 启用（如需按地区限制）
- **WebSockets**: 确保为 ON（如有实时需求）

### 8. 配置缓存（Caching）

进入 **Caching** → **Configuration**：

- **Browser Cache TTL**: 4 hours (默认)
- **Always Online**: ON (推荐)
- **Development Mode**: OFF (生产环境)

### 9. 更新环境变量

确保你的 Render 环境变量中：

**后端 (.env)**:
```bash
PUBLIC_BASE_URL=https://api.your-domain.com  # 或你的自定义域名
CORS_ORIGIN=https://your-domain.com           # 前端域名
COOKIE_SECURE=true
COOKIE_DOMAIN=.your-domain.com                # 注意前导点，用于所有子域名
```

**前端环境变量 (Render)**:
```bash
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

### 10. 测试

部署完成后，测试以下功能：

1. ✅ 访问 https://your-domain.com （前端正常显示）
2. ✅ 访问 https://api.your-domain.com/api/health （后端健康检查）
3. ✅ 注册/登录功能正常
4. ✅ 上传图片正常（检查图片 URL 是否通过你的域名）
5. ✅ 管理后台 (https://your-domain.com/admin) 可访问

### 11. 性能优化建议

1. **启用 Argo Smart Routing** (付费): 加速全球访问
2. **配置 Early Hints** (免费): 进入 **Speed** → **Optimization** → 开启 **Early Hints**
3. **使用 Polish 和 Mirage** (付费): 图片自动优化
4. **配置 Brotli 压缩**: 自动启用，无需配置

### 12. SEO 配置

进入 **SEO** → **Advanced**：

- 确保 **Always Online™** 已启用
- 配置 **IP Geolocation Header** 如果需要

### 13. 日志和监控

进入 **Analytics & Logs**：

- 查看 **Security Event** 监控攻击
- 查看 **Firewall Events** 查看被拦截的请求
- 设置 **Notifications** 接收警报

## 常见问题

### Q: 图片上传后无法访问？
A: 检查：
1. 后端 `PUBLIC_BASE_URL` 是否设置正确
2. 图片 URL 是否使用你的域名而不是 `localhost`
3. Cloudflare 缓存规则是否影响上传路径

### Q: 登录后 Cookie 不工作？
A: 检查：
1. `COOKIE_DOMAIN` 是否设置（如 `.your-domain.com`）
2. `COOKIE_SECURE=true`
3. CORS_ORIGIN 是否正确
4. 浏览器开发者工具查看 Set-Cookie 头

### Q: 出现 403 Forbidden？
A: 检查 Cloudflare Security Level 设置，可能过严。可降低到 "Low" 测试。

### Q: API 请求慢？
A: 检查：
1. Render 后端配置是否正确（最低配置 512MB RAM）
2. Neon 数据库位置（应选择离 Render 最近的区域）
3. 考虑启用 Cloudflare Argo

### Q: 如何重置 Cloudflare 设置？
A: 在 DNS 页面将所有记录设为 "DNS Only"（灰色云）即可绕过 Cloudflare。

## 成本

- **Cloudflare Free 套餐**: $0/月，功能齐全
- **Render Free 套餐**: $0/月（有休眠限制）
- **Neon Free 套餐**: 最多 10 万行/月，500MB 存储

## 总结

配置完成后，你的网站将获得：
- ✅ 全球 CDN 加速
- ✅ DDoS 防护
- ✅ WAF 防火墙
- ✅ SSL 证书自动管理
- ✅ 免费且不限带宽的 HTTPS
- ✅ 24/7 正常运行时间监控

---

**下一步**: 更新你的代码中的 API URL 和环境变量，确保所有链接使用你的自定义域名。
