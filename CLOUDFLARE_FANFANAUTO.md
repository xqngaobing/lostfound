# Cloudflare 针对 fanfanauto.top 的配置清单

## DNS 记录

进入 Cloudflare Dashboard → `fanfanauto.top` → **DNS** → **Records**

| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| CNAME | @ | zhenyuan-frontend.onrender.com | 🌩️ Proxied | Auto |
| CNAME | api | zhenyuan-backend.onrender.com | 🌩️ Proxied | Auto |

**验证**:
```bash
nslookup fanfanauto.top
# 应显示 CNAME → zhenyuan-frontend.onrender.com

nslookup api.fanfanauto.top
# 应显示 CNAME → zhenyuan-backend.onrender.com
```

## SSL/TLS 设置

**SSL/TLS** → **Overview**:
- [x] **Full (strict)** ✅

**SSL/TLS** → **Edge Certificates**:
- [x] Always Use HTTPS
- [x] Automatic HTTPS Rewrites
- [x] Minimum TLS Version: TLS 1.2
- [x] TLS 1.3

## Page Rules

进入 **Rules** → **Page Rules** → 添加以下规则（顺序重要）：

### 优先级 1: 强制 HTTPS (根域名)

```
URL: http://fanfanauto.top/*
Rule Name: Redirect to HTTPS (root)
Forwarding URL (301): https://fanfanauto.top/$1
```

### 优先级 2: 强制 HTTPS (API)

```
URL: http://api.fanfanauto.top/*
Rule Name: Redirect to HTTPS (api)
Forwarding URL (301): https://api.fanfanauto.top/$1
```

### 优先级 3: 缓存 Next.js 静态资源

```
URL: https://fanfanauto.top/_next/static/*
Rule Name: Cache Next.js Static
Cache Level: Cache Everything
Edge Cache TTL: 1 year
Browser Cache TTL: 1 year
Bypass Cache on Cookie: OFF
```

### 优先级 4: API 不缓存

```
URL: https://fanfanauto.top/api/*
Rule Name: No Cache API
Disable Performance
Disable Security (如果 API 被 WAF 拦截则关闭)
```

**注意**: Page Rules 顺序从上到下，优先级递减。

## 规则验证

检查生效：
1. 访问 http://fanfanauto.top → 自动跳转 https
2. 访问 https://fanfanauto.top/_next/static/xxx → 响应头有 `cf-cache-status: HIT`
3. 访问 https://fanfanauto.top/api/health → 响应头 `cf-cache-status: BYPASS` (不缓存)
4. 访问 http://api.fanfanauto.top/api/health → 自动跳转 https

## Security Settings（可选）

**Security** → **Settings**:
- [x] Bot Fight Mode
- [x] Email Address Obfuscation
- [ ] Content Security Policy (CSP) - 如果添加需配置

## Caching 设置

**Caching** → **Configuration**:
```
Browser Cache TTL: 4 hours
Always Online: ON (推荐)
```

## 提交抓取（可选）

如果 Render 未及时部署新版本，手动触发：

**Caching** → **Custom Purge** → Purge Everything

或针对特定 URL：

**Rules** → **Cache Rules** → **Add rule**:

```
Cache By Device Type: Desktop, Mobile
Cache Deception: OFF
```

---

## 配置完成后检查清单

- [ ] DNS 2 条 CNAME 记录已添加（根域名 + api 子域名）
- [ ] SSL/TLS 设置为 Full (strict)
- [ ] Always Use HTTPS 已开启
- [ ] Page Rules 4 条规则已添加（顺序正确）
- [ ] 访问 https://fanfanauto.top 可打开前端
- [ ] 访问 https://api.fanfanauto.top/api/health 可看到 {"status":"ok"}
- [ ] 图片上传后能正常显示（URL 为 api.fanfanauto.top）

## 快速修改

如需临时关闭代理（排查问题）：

在 DNS 记录中点击橙色云 → 变为灰色云（DNS only）

恢复时再点击变回橙色云。

---

**下一步**: 确保 Render 环境变量中的 `PUBLIC_BASE_URL` 和 `CORS_ORIGIN` 已更新为你的域名。
