# Whooper 2.0 上线前需要你出面的账号 / 密钥清单

> 原则：所有密钥只填在部署平台（Vercel / 本地 `.env.local`）里，不进聊天、不进 Git、不进日志。
> 到哪一步需要你动手，我会单独叫你；下面是完整清单，方便你一次准备。

## 1. WHOOP Developer Dashboard（必须，P0）
- 在 https://developer.whoop.com/ 创建一个 App
- 记下 **Client ID** 和 **Client Secret**
- 注册 Redirect URL：`https://<你的域名>/api/auth/whoop/callback`
  （本地联调用 `http://localhost:3000/api/auth/whoop/callback` 先占位，WHOOP 要求 HTTPS，正式回调以后换）
- 注册 Webhook URL：`https://<你的域名>/api/webhooks/whoop`（P1 用，P0 可先不填）
- 申请 Scopes（授权时用户会看到）：
  `read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement offline`
  其中 `offline` 是拿 Refresh Token 的关键，没有它掉线后要重新授权

## 2. Neon PostgreSQL（必须，P0）
- 建一个 Postgres 数据库（dev / prod 分开）
- 拿到 **DATABASE_URL**（连接串）
- 我会在项目里用 Prisma 生成表结构（users / whoop_connections / whoop_records / sync_jobs / webhook_events / daily_metrics / audit_events）

## 3. Clerk（必须，P0）
- 建一个应用，拿到 **CLERK_SECRET_KEY** 和 **NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY**
- MCP 那一侧用 Clerk 做 OAuth 授权服务器（PKCE S256），ChatGPT 连 `/api/mcp` 时走它验身份
- 注意：这是两套 OAuth——ChatGPT→Whooper（Clerk）和 Whooper→WHOOP（上面的 Client ID/Secret），别混

## 4. Vercel（部署时需要，P0 尾声）
- 把 Vercel 账号连上 Muse（到时我会给你连接入口）
- 部署后在 Vercel 项目里填环境变量：
  - `DATABASE_URL`
  - `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET`
  - `WHOOP_REDIRECT_URI`（部署域名确定后填）
  - `TOKEN_ENCRYPTION_KEY_BASE64`（32 字节随机，base64；我会给你生成命令，自己跑）
  - `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_APP_URL`（部署域名）
  - `CRON_SECRET`（给 reconcile 定时任务用的口令）

## 5. 你本人点一下（P0 验收）
- 在 WHOOP 授权页用你自己的 WHOOP 账号点“同意”，完成第一次绑定（拿 `offline` refresh token）
- 在 ChatGPT Web 的 Work 模式里连上 `/api/mcp`，跑一次 `get_daily_snapshot`

## 现在不需要你动的
- 本地脚手架、依赖安装、构建验证：我在 VM 上直接搞
- 密钥生成命令我会给你，你在自己电脑上跑，结果贴进 Vercel 就行，不用发给我
