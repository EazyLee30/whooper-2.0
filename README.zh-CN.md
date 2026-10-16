<p align="center"><img src="docs/assets/banner.png" alt="Whooper — Know your rhythm." width="100%"></p>
<p align="center">
<a href="https://whooper.ccwu.cc"><img src="https://img.shields.io/badge/Public_trial-Visit-143F32?style=flat-square" alt="Public trial"></a>
<a href="https://github.com/EazyLee30/whooper-2.0/actions/workflows/checks.yml"><img src="https://github.com/EazyLee30/whooper-2.0/actions/workflows/checks.yml/badge.svg" alt="Checks"></a>
<img src="https://img.shields.io/badge/Plugin-v0.2.1-8EDDA8?style=flat-square" alt="Plugin v0.2.1">
<img src="https://img.shields.io/badge/WHOOP_API-v2-143F32?style=flat-square" alt="WHOOP API v2">
<img src="https://img.shields.io/badge/MCP-Streamable_HTTP-FF735D?style=flat-square" alt="MCP Streamable HTTP">
</p>
<p align="center"><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a></p>

# Whooper

你的恢复、睡眠与训练教练，提供 ChatGPT 和 Codex 插件，并支持 Muse 通过认证 MCP 接入。

保留原 GPT 的完整教练指令和六类 WHOOP 数据功能，结合只读 MCP 工具、详情查询、每日快照与历史覆盖检查。每位用户登录自己的账号并授权自己的 WHOOP。

**[公开试用](https://whooper.ccwu.cc)** · [下载插件安装包](https://github.com/EazyLee30/whooper-2.0/releases/tag/v0.2.1) · [插件源码](plugin) · [隐私说明](https://whooper.ccwu.cc/privacy)

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

MCP 地址：`https://whooper.ccwu.cc/api/mcp`。认证 MCP 客户端会在初始化响应中获得教练指引，并通过 `tools/list` 发现工具；完整插件还将指引打包为 portable skill，并附带客户端元数据与品牌素材。

**试用状态：**目前使用 Clerk 开发实例；WHOOP 应用目前为 Sandbox，最多连接 10 人（2026-10-10 检查时已连接 1 人）。源码公开和提供安装包不等于已通过通用插件目录审核。真实账号验收与目录提交分别进行。

## Muse 支持

Muse 可通过同一认证只读 MCP 接口查询 Whooper。**2026-10-15 已验证：**OAuth 授权、刷新令牌轮换、全部 14 个工具的自动发现、连接状态、每日快照、睡眠／恢复／训练详情、历史覆盖和同步状态；新进程查询及三个并发 helper 进程也通过测试。

实测方案是在 **Muse 智能体的 VM 内配置本地 helper**，不是 Muse 原生 connector，也不是安装 portable plugin。helper 与凭证需在该环境单独配置，本仓库不包含该脚本。配置完成后，可以直接问 Muse：“昨晚睡得怎么样？”“比较我的恢复和训练情况。”

### 接入 Muse

1. 先登录 [Whooper](https://whooper.ccwu.cc)，连接自己的 WHOOP 账户。
2. 在 Clerk → Configure → Developers → OAuth applications 中，为 Whooper 使用的公共 OAuth 客户端登记精确回调地址 `https://whooper.ccwu.cc/connect/muse`。自行部署时替换域名及 client ID，保留已有回调地址和授权确认页。
3. 让 Muse 为 `https://whooper.ccwu.cc/api/mcp` 配置持久化 MCP helper：生成新的 PKCE S256 verifier/challenge 和随机 `state`，私下保留 verifier，以 `openid offline_access` 为 scope、MCP 地址为 `resource` 发起授权。授权和令牌端点从授权服务器的 discovery 文档读取；公开试用的 client ID 为 `EsrIyDTsryA3lxTL`。
4. 让 Muse 把授权 URL 放在纯文本代码块中，复制到外部浏览器地址栏，用同一 Whooper 账号登录并批准。实测 Muse 客户端直接点击聊天内的 OAuth 链接会弹出 Accounts 窗口，随后关闭而未完成流程。
5. 回调页显示一次性授权码，只交给持有匹配 verifier 的可信 Muse 会话。helper 必须校验 `state`，用该 verifier 和完全一致的回调地址交换令牌。这是手动授权码交接，回调页不会自动换取或保存令牌。
6. 验证 `initialize`、`tools/list`、`get_connection_status` 及真实 `get_daily_snapshot`。Clerk 凭证私存于 Muse VM，采用仅所有者可读写的权限（如 `0600`）；刷新轮换须串行执行并原子保存新凭证。Access／refresh token 和 verifier 不得写入聊天、记忆文件或 GitHub。WHOOP 令牌仍由 Whooper 服务端加密保存，查询出的健康数据会返回 Muse 对话。

若 Clerk 报回调不匹配，检查白名单中的精确地址。若 helper 发现的工具为空，应按 JSON-RPC 请求 ID 解析 Streamable HTTP 的 JSON／SSE 响应，不要默认最后一帧就是结果，并遵循协商后的 MCP 初始化和协议流程。实测服务为无状态模式，不返回 `Mcp-Session-Id`。撤销 Clerk 授权或丢失 VM 凭证后需重新连接 Muse；Muse 授权与 WHOOP 账户授权是两个独立环节。

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

验证：`npm test`、`npm run lint`、`npm run build`。历史同步支持分页断点续传；每日 cron 使用服务端密钥。令牌加密存储，健康记录缓存在数据库中；查询的数据会返回发起请求的 ChatGPT、Codex 或已配置的 Muse 对话。

独立社区项目，与 WHOOP 无关联或背书。教练建议用于信息参考，不提供医疗诊断。

### Strength Trainer（可选）

部署前运行 `npx prisma migrate deploy`，应用 `0003_strength_session` 迁移。在「连接设置」先完成 WHOOP OAuth 连接，再通过 Strength Trainer 表单登录**同一 WHOOP 账号**。支持短信、验证器和邮件验证码；密码不保存，会话沿用 `TOKEN_ENCRYPTION_KEY_BASE64` 加密并自动刷新。过期失效后可在此重新登录，也可单独断开。

新增 MCP 工具：`list_strength_workouts`、`get_strength_workout`、`get_strength_exercise`、`get_strength_personal_records`。先列出训练，再用 workout UUID 查动作汇总；用汇总中的 `exercise_id` 查询逐组次数/重量与 PR。列表仅筛选一页，空页有 `nextCursor` 仍需翻页。字段与单位保留 WHOOP 原值；动作历史可能含多次训练，应按日期匹配。

此功能参考 [Totem 的 Strength Trainer/Cognito 实现](https://github.com/thebriangao/totem)，使用 WHOOP App 私有接口，独立于官方 OAuth API，接口可能变动。数据按需实时读取，不加入后台回填或缓存覆盖统计。现有 OAuth 凭据不能代替 App 会话。部署后需实际登录并查询自己的训练才能确认上游兼容性。
