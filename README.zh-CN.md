<p align="center"><img src="docs/assets/banner.png" alt="Whooper — Know your rhythm." width="100%"></p>
<p align="center">
<a href="https://whooper-peach.vercel.app"><img src="https://img.shields.io/badge/Public_trial-Visit-143F32?style=flat-square" alt="Public trial"></a>
<a href="https://github.com/EazyLee30/whooper-2.0/actions/workflows/checks.yml"><img src="https://github.com/EazyLee30/whooper-2.0/actions/workflows/checks.yml/badge.svg" alt="Checks"></a>
<img src="https://img.shields.io/badge/Plugin-v0.2.0-8EDDA8?style=flat-square" alt="Plugin v0.2.0">
<img src="https://img.shields.io/badge/WHOOP_API-v2-143F32?style=flat-square" alt="WHOOP API v2">
<img src="https://img.shields.io/badge/MCP-Streamable_HTTP-FF735D?style=flat-square" alt="MCP Streamable HTTP">
</p>
<p align="center"><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a></p>

# Whooper

你的恢复、睡眠与训练教练，现已迁移为 ChatGPT 和 Codex 插件。

保留原 GPT 的完整教练指令和六类 WHOOP 数据功能，结合只读 MCP 工具、详情查询、每日快照与历史覆盖检查。每位用户登录自己的账号并授权自己的 WHOOP。

**[公开试用](https://whooper-peach.vercel.app)** · [下载插件安装包](https://github.com/EazyLee30/whooper-2.0/releases/tag/v0.2.0) · [插件源码](plugin) · [隐私说明](https://whooper-peach.vercel.app/privacy)

## 功能

| 数据 | 能力 |
| --- | --- |
| 基本资料、身体数据 | 读取账户资料和身体测量 |
| 恢复、cycle | 分页列表、详情、校准与评分状态 |
| 睡眠 | 主睡眠、小睡、阶段与原始评分 |
| 训练 | 活动、strain 与完整指标 |
| 每日快照 | 按 cycle 关系和时区关联恢复、睡眠、训练 |
| 历史记录 | 原生游标分页、可恢复同步、缓存覆盖检查 |

例如：“分析我最近七天的恢复和睡眠”“结合今天的状态安排训练”。缺失数据保持缺失，未完成评分不会被当成零。

## 使用

1. 打开试用地址并登录。
2. 连接 WHOOP，批准所需的只读权限。
3. 在支持 portable plugin 的客户端安装 `plugin/` 中的完整插件包。
4. 用同一 Whooper 账号授权插件，先检查连接，再查询数据。

MCP 地址：`https://whooper-peach.vercel.app/api/mcp`。只添加 MCP 地址会提供工具；安装完整插件才能同时带上原 GPT 的教练指令。

**试用状态：**目前使用 Clerk 开发实例；WHOOP 应用目前为 Sandbox，最多连接 10 人（2026-10-10 检查时已连接 1 人）。源码公开和提供安装包不等于已通过通用插件目录审核。真实账号验收与目录提交分别进行。

## 自行部署

需要 Node.js 24、PostgreSQL、Clerk OAuth 应用和 WHOOP 开发者应用。

```sh
npm ci
cp .env.example .env.local
# 填写自己的配置，不要提交密钥
npx prisma migrate deploy
npm run dev
```

WHOOP 回调：`<APP_URL>/api/auth/whoop/callback`；Webhook：`<APP_URL>/api/webhooks/whoop`。Clerk 公共 OAuth 客户端须启用 PKCE 并配置客户端回调地址。修改插件中的服务地址和 OAuth client ID。

验证：`npm test`、`npm run lint`、`npm run build`。历史同步支持分页断点续传；每日 cron 使用服务端密钥。令牌加密存储，健康记录缓存在数据库中；插件查询的数据会返回当前 ChatGPT 或 Codex 对话。

独立社区项目，与 WHOOP 无关联或背书。教练建议用于信息参考，不提供医疗诊断。
