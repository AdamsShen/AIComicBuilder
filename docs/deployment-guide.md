# 公网部署准备清单

## 环境变量

部署前在服务器/容器中设置以下环境变量：

```bash
# --- 必须修改 ---

# 应用公网地址（替换为实际域名，末尾不带斜杠）
BETTER_AUTH_URL=https://your-domain.com
NEXT_PUBLIC_BETTER_AUTH_URL=https://your-domain.com

# Better Auth 密钥（生成命令：openssl rand -base64 32）
BETTER_AUTH_SECRET=<生成随机密钥>

# --- 数据库 ---
# SQLite 文件路径（Docker 用 /app/data/aicomic.db，挂 volume 持久化）
DATABASE_URL=file:./data/aicomic.db

# 上传文件目录（Docker 用 /app/uploads，挂 volume 持久化）
UPLOAD_DIR=./uploads

# --- Stripe（生产密钥）---
# 前往 https://dashboard.stripe.com/apikeys 获取（确认右上角为 "View live data"）
STRIPE_SECRET_KEY=sk_live_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx

# Webhook 签名密钥：在 Stripe Dashboard → Developers → Webhooks 创建
# Endpoint URL: https://your-domain.com/api/stripe/webhook
# Events: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Stripe Price ID（生产环境在 Stripe Dashboard → Products 创建）
STRIPE_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_YEARLY_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID=price_xxxxx

# Stripe 美元充值汇率（默认 7.25，可按需调整）
# STRIPE_TO_CNY_RATE=7.25

# --- 支付宝（生产密钥）---
# 前往 https://open.alipay.com/ 创建应用获取
ALIPAY_APP_ID=<生产应用 APPID>
ALIPAY_PRIVATE_KEY=<应用私钥>
ALIPAY_PUBLIC_KEY=<支付宝公钥>
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_PRICE_MONTHLY=138
ALIPAY_PRICE_YEARLY=1380
```

## 代码改动

### 1. 邮件服务对接

**文件**: `src/lib/auth/index.ts:21`

当前邮箱验证 token 仅 `console.log` 打印到控制台，生产必须对接邮件服务。

```typescript
// 当前（开发用）
emailVerification: {
  sendVerificationEmail: async ({ user, url, token }) => {
    console.log(`[Auth] Verification for: ${user.email}`);
    console.log(`[Auth] URL: ${url}`);
  },
},

// 方案 A：Resend（推荐，免费额度 100 封/天）
// 安装: pnpm add resend
// 环境变量: RESEND_API_KEY
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

emailVerification: {
  sendVerificationEmail: async ({ user, url }) => {
    await resend.emails.send({
      from: "noreply@your-domain.com",
      to: user.email,
      subject: "登录验证 - AI Comic Builder",
      html: `<p>点击 <a href="${url}">此处</a> 登录。</p>`,
    });
  },
},

// 方案 B：SendGrid / 阿里云邮件推送 / 其他 SMTP 服务
```

### 2. 健康检查端点（建议添加）

新建 `src/app/api/health/route.ts`：

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: Date.now() });
}
```

## Docker 部署

### 构建与运行

已有 Dockerfile（`output: "standalone"` + ffmpeg + CJK 字体），直接构建：

```bash
# 构建
docker build -t ai-comic-builder .

# 运行（挂载数据目录持久化）
docker run -d \
  --name ai-comic-builder \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/uploads:/app/uploads \
  --env-file .env \
  ai-comic-builder
```

### Docker Compose（建议添加）

新建 `docker-compose.yml`：

```yaml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - data:/app/data
      - uploads:/app/uploads
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  data:
  uploads:
```

### 数据库注意事项

- **单实例**：挂载 volume 即可，数据在宿主机上持久化
- **多实例/水平扩容**：`better-sqlite3` 不支持网络连接，需要迁移到 PostgreSQL 或 MySQL。改 Drizzle driver 和连接字符串即可，schema 无需大改

## HTTPS 与反向代理

### Nginx 反代（自建服务器）

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/ssl/certs/your-domain.pem;
    ssl_certificate_key /etc/ssl/private/your-domain.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

SSL 证书可使用 Let's Encrypt (certbot) 或阿里云免费证书。

### Vercel 部署

零配置，直接 `vercel --prod`。无需 Nginx，自动 HTTPS。但 SQLite 数据持久化需要 Vercel KV/Postgres 或外部数据库。

## 外部服务配置清单

| 服务 | 操作 |
|------|------|
| **Stripe** | Dashboard → Webhooks 注册 `https://your-domain.com/api/stripe/webhook`，events 勾选 4 个 checkout/subscription 事件 |
| **支付宝** | 开放平台 → 应用配置 → 设置应用网关、授权回调地址为 `https://your-domain.com/api/alipay/return` |
| **邮箱** | 注册 Resend/SendGrid 获取 API Key，填入环境变量，修改 `auth/index.ts` |
| **域名** | 配置 A 记录指向服务器 IP（Vercel 则 CNAME 指向 `cname.vercel-dns.com`） |

## 部署前检查清单

- [ ] `BETTER_AUTH_URL` 已改为公网 HTTPS 地址
- [ ] `BETTER_AUTH_SECRET` 已生成随机密钥
- [ ] Stripe 密钥替换为 `sk_live_` / `pk_live_`
- [ ] Stripe Dashboard 已注册生产 webhook endpoint
- [ ] 支付宝密钥替换为正式应用密钥
- [ ] 支付宝网关为 `https://openapi.alipay.com/gateway.do`
- [ ] 邮箱服务已对接（不再 console.log）
- [ ] SSL 证书已配置
- [ ] 数据目录已挂载 volume 持久化
- [ ] 健康检查端点已添加
- [ ] `docker build` 成功，`docker run` 验证正常
