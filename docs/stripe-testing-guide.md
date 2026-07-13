# Stripe 沙盒环境接入与测试指南

## 前置条件

- 项目已 clone，`pnpm install` 完成
- Stripe CLI 已安装并登录（见下方安装步骤）

---

## 1. 安装 Stripe CLI 并登录

```bash
# 安装（macOS）
brew install stripe/stripe-cli/stripe

# 登录 Stripe 账号（自动打开浏览器跳转 Dashboard 授权）
stripe login

# 确认登录成功
ls ~/.config/stripe/config.toml  # 应存在，含 account_id
```

> CLI 登录信息持久化在 `~/.config/stripe/config.toml`，后续无需重复登录。

---

## 2. 配置环境变量

### 2.1 获取密钥

打开 [Stripe Dashboard → API Keys](https://dashboard.stripe.com/test/apikeys)，确认右上角 **"View test data"** 开启。

复制以下两个值：

| 变量 | 值 |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |

> 如果你的 Stripe CLI 已登录（`~/.config/stripe/config.toml` 存在），可以直接从配置文件中获取 `test_mode_api_key` 和 `test_mode_pub_key`。

### 2.2 创建商品和价格（Stripe CLI）

```bash
# 1. 创建月付商品
stripe products create \
  --name "Comic Builder Pro — Monthly" \
  --description "AI 漫画生成器 Pro 会员，月付订阅" \
  --type service

# 2. 创建年付商品
stripe products create \
  --name "Comic Builder Pro — Yearly" \
  --description "AI 漫画生成器 Pro 会员，年付订阅" \
  --type service

# 3. 创建月付价格（$19.00/mo，注意 stripe CLI 嵌套参数需用 -d）
stripe prices create \
  --currency usd \
  --unit-amount 1900 \
  --product <月付商品PROD_ID> \
  -d "recurring[interval]=month" \
  -d "recurring[interval_count]=1"

# 4. 创建年付价格（$190.00/yr）
stripe prices create \
  --currency usd \
  --unit-amount 19000 \
  --product <年付商品PROD_ID> \
  -d "recurring[interval]=year" \
  -d "recurring[interval_count]=1"
```

> 记下两个 `price_...` ID，填入 `.env`。

### 2.3 获取 Webhook Secret

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook --print-secret
```

终端输出的 `whsec_...` 即 `STRIPE_WEBHOOK_SECRET`。

> **注意**：`stripe listen` 需要保持运行才能转发 webhook 到本地。建议另开终端窗口运行（不加 `--print-secret` 即可只做转发）：
> ```bash
> stripe listen --forward-to localhost:3000/api/stripe/webhook
> ```

### 2.4 填入 `.env`

```env
# Stripe 订阅支付
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_YEARLY_PRICE_ID=price_...

# 客户端组件需要的 Price ID（供 plans.ts 用，必须有 NEXT_PUBLIC_ 前缀）
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID=price_...
```

> `NEXT_PUBLIC_STRIPE_*_PRICE_ID` 用于客户端组件 `plan-card.tsx` → `SubscribeButton`，不可省略。

---

## 3. 启动开发环境

```bash
# 终端 1：启动 Next.js dev server
pnpm dev

# 终端 2：启动 webhook 转发
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

验证：

```bash
# pricing 页可达
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/zh/pricing
# 应返回 200

# checkout 端点需要认证
curl -s -X POST http://localhost:3000/api/stripe/checkout \
  -H "Content-Type: application/json" \
  -d '{}' -w "\n%{http_code}"
# 应返回 401 {"error":"请先登录"}
```

---

## 4. 走一遍完整订阅流程

### 4.1 前置：确保账号无有效套餐

在定价页用已有账号登录后，如果之前订阅过 Pro，会被 `redirect("/")` 到项目页。如需重新测试订阅流程：

```bash
# 清空本地订阅记录
sqlite3 data/aicomic.db "DELETE FROM subscriptions WHERE user_id = '<YOUR_USER_ID>';"

# 同时更新 alipay 订单到期时间（如有）
sqlite3 data/aicomic.db "UPDATE alipay_orders SET period_end = unixepoch(), status = 'expired' WHERE user_id = '<YOUR_USER_ID>' AND status = 'paid';"
```

### 4.2 订阅

1. 浏览器打开 `http://localhost:3000/zh/pricing`
2. 登录已有账号（或用 Google 登录注册新号）
3. 选择 Pro 套餐（月付 $19 或年付 $190）
4. 点击订阅按钮 → 跳转 Stripe Checkout 收银台
5. 填写测试卡号：

| 字段 | 值 |
|---|---|
| 卡号 | `4242 4242 4242 4242` |
| 过期日期 | 任意未来日期（如 `12/30`） |
| CVC | 任意 3 位（如 `123`） |
| 持卡人姓名 | 任意英文 |

6. 点击支付 → 自动跳回应用首页（`/?checkout=success`）

### 4.3 验证

**Webhook 写入**：查看 dev server 终端日志，应出现：

```
[Stripe Webhook] subscription: { id: 'sub_...', userId: '...', periodStart: 1..., periodEnd: 1..., status: 'active', interval: 'month' }
```

**DB 验证**：

```bash
sqlite3 data/aicomic.db "SELECT stripe_subscription_id, amount, currency, status, interval, datetime(current_period_start, 'unixepoch'), datetime(current_period_end, 'unixepoch') FROM subscriptions;"
```

预期输出一条 `active` 记录，金额为 `1900`（$19.00）或 `19000`（$190.00），货币为 `usd`。

**前端验证**：

- `/zh/pricing` → 自动重定向到 `/`（hasActivePlan = true）
- `/billing` → 显示订阅记录，包含金额、货币、周期、到期时间
- `/api/plan` → 返回 `{"plan":null,"isPro":true,"source":"stripe"}`

---

## 5. 测试其他场景

### 5.1 测试卡号

| 卡号 | 场景 |
|---|---|
| `4242 4242 4242 4242` | 支付成功（万能测试卡） |
| `4000 0025 0000 3155` | 需要 3D Secure 认证 |
| `4000 0000 0000 0002` | 支付被拒绝 |
| `4000 0000 0000 9995` | 余额不足 |

### 5.2 触发测试 Webhook 事件

```bash
# 模拟 subscription 创建事件
stripe trigger customer.subscription.created

# 列出所有可触发事件
stripe trigger
```

> **注意**：`stripe trigger` 生成的测试数据没有我们 app 的 `metadata.userId`，webhook 会跳过写入。要想真正写入，必须走真实 Checkout 流程。

### 5.3 取消订阅

在 `/billing` 页面点击"管理订阅（Stripe 门户）" → Cancel plan，触发 `customer.subscription.deleted` webhook。

---

## 6. 常见问题排查

### 6.1 `Invalid Stripe API version`

**现象**：checkout 返回 500 `"Invalid Stripe API version: 2025-06-16.basil"`

**原因**：`src/lib/stripe/index.ts` 里硬编码了不存在的 API 版本。

**修复**：移除 `apiVersion` 字段，让 SDK 用内置默认版本。

```ts
// src/lib/stripe/index.ts
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  httpClient: Stripe.createFetchHttpClient(),
  // 不要硬编码 apiVersion
});
```

### 6.2 `empty string for line_items[0][price]`

**现象**：checkout 返回 500 `"You passed an empty string for 'line_items[0][price]'"`

**原因**：`plans.ts` 用 `process.env.STRIPE_MONTHLY_PRICE_ID`（无 `NEXT_PUBLIC_` 前缀），客户端组件拿不到。

**修复**：改用 `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` / `NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID`，并在 `.env` 中补齐。

### 6.3 `NOT NULL constraint failed: subscriptions.current_period_start`

**现象**：webhook 日志报 SQLite NOT NULL 错误，写入失败。

**原因**：`constructEvent()` 返回的是 Stripe API 原始 JSON（**snake_case** 字段名，如 `current_period_start`），不是 SDK 类型定义的 camelCase。且 `current_period_start/end` 在 `items.data[0]` 嵌套层级上，不在 Subscription 根对象。

**修复**：从 `obj.items.data[0]` 取 `current_period_start`/`current_period_end`，并做 snake_case/camelCase 双 fallback。

```ts
const firstItem = obj.items?.data?.[0];
const periodStart = firstItem?.current_period_start ?? firstItem?.currentPeriodStart ?? 0;
const periodEnd = firstItem?.current_period_end ?? firstItem?.currentPeriodEnd ?? 0;
```

### 6.4 订阅后前端仍显示"未订阅"

**排查步骤**：

1. 检查 `subscriptions` 表是否写入：`sqlite3 data/aicomic.db "SELECT * FROM subscriptions;"`
2. 检查 webhook 日志是否有报错：查看 dev server 终端
3. 确认 `status` 列值为 `active`（而非 `canceled`）
4. 确认 `current_period_end` 是 Unix 整数时间戳（而非 TEXT），且大于当前时间：
   ```bash
   sqlite3 data/aicomic.db "SELECT typeof(current_period_end), current_period_end, datetime(current_period_end, 'unixepoch') FROM subscriptions;"
   ```
5. 如果 `current_period_end` 是 TEXT 格式，需转换：
   ```bash
   sqlite3 data/aicomic.db "UPDATE subscriptions SET current_period_end = unixepoch(current_period_end), current_period_start = unixepoch(current_period_start) WHERE typeof(current_period_start) = 'text';"
   ```

### 6.5 账单详情页日期/金额为空

- **日期为空**：时间戳字段存成了 TEXT 而非 INTEGER。见上面第 5 步转换。
- **金额为空**：DB schema 需有 `amount` (INTEGER) 和 `currency` (TEXT) 列，webhook 需写入这两列。

### 6.6 Webhook 签名验证失败

- `.env` 中 `STRIPE_WEBHOOK_SECRET` 是否与 `stripe listen` 输出的 `whsec_...` 一致
- 每次 `stripe login` 后 secret 可能更新

---

## 7. 重置环境重新测试

```bash
# 1. 清空本地订阅
sqlite3 data/aicomic.db "DELETE FROM subscriptions;"

# 2. 清空支付宝订单
sqlite3 data/aicomic.db "UPDATE alipay_orders SET status='expired', period_end=unixepoch() WHERE status='paid';"

# 3. 取消 Stripe 侧所有 active 订阅
for sub_id in $(stripe subscriptions list --status active --limit 100 2>/dev/null | python3 -c "import json,sys; [print(s['id']) for s in json.load(sys.stdin)['data']]" 2>/dev/null); do
  stripe subscriptions cancel "$sub_id" --confirm
done

# 4. 确认两端都干净
echo "=== 本地 ===" && sqlite3 data/aicomic.db "SELECT count(*) FROM subscriptions WHERE status IN ('active','trialing');"
echo "=== Stripe 侧 ===" && stripe subscriptions list --status active --limit 5
```

---

## 8. 架构链路速查

```
浏览器 /pricing
  → SubscribeButton 调 POST /api/stripe/checkout
    → stripe.checkout.sessions.create({
        mode: "subscription",
        subscription_data: { metadata: { userId, interval } }  // ⚠️ metadata 放这里，不放 Session 根
      })
    → 返回 checkout.url → 浏览器跳转 Stripe 收银台

Stripe 收银台支付成功
  → Stripe 发送 webhook 到 stripe listen 转发
    → POST /api/stripe/webhook (本地)
      → constructEvent 验签
      → 从 event.data.object.items.data[0] 取 current_period_start/end  // ⚠️ 嵌套位置
      → 写入 subscriptions 表

前端 /billing
  → GET /api/billing (聚合 stripe subscriptions + alipay orders)
  → 展示账单列表

前端 /api/plan
  → getMembership() 聚合两渠道，取最晚到期
  → 返回 isPro / source / plan
```
