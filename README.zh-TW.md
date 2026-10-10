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

你的恢復、睡眠與訓練教練，現已遷移為 ChatGPT 和 Codex 外掛。

保留原 GPT 的完整教練指令與六類 WHOOP 資料功能，結合唯讀 MCP 工具、詳細資料查詢、每日快照與歷史涵蓋範圍檢查。每位使用者登入自己的帳號並授權自己的 WHOOP。

**[公開試用](https://whooper-peach.vercel.app)** · [外掛原始碼](plugin) · [隱私說明](https://whooper-peach.vercel.app/privacy)

## 功能

| 資料 | 能力 |
| --- | --- |
| 基本資料、身體資料 | 讀取帳戶資料與身體測量 |
| 恢復、cycle | 分頁清單、詳細資料、校準與評分狀態 |
| 睡眠 | 主睡眠、小睡、階段與原始評分 |
| 訓練 | 活動、strain 與完整指標 |
| 每日快照 | 依 cycle 關係與時區串聯恢復、睡眠、訓練 |
| 歷史紀錄 | 原生游標分頁、可恢復同步、快取涵蓋範圍檢查 |

例如：「分析我最近七天的恢復和睡眠」「依照今天的狀態安排訓練」。缺漏資料保持缺漏，尚未完成的評分不會被當成零。

## 使用

1. 開啟試用網址並登入。
2. 連接 WHOOP，批准所需的唯讀權限。
3. 在支援 portable plugin 的用戶端安裝 `plugin/` 中的完整外掛套件。
4. 用同一 Whooper 帳號授權外掛，先檢查連線，再查詢資料。

MCP 網址：`https://whooper-peach.vercel.app/api/mcp`。只加入 MCP 網址會提供工具；安裝完整外掛才能同時包含原 GPT 的教練指令。

**試用狀態：**目前使用 Clerk 開發執行個體；WHOOP 應用程式目前為 Sandbox，最多連接 10 人（2026-10-10 檢查時已連接 1 人）。公開原始碼與提供安裝包不代表已通過通用外掛目錄審核。真實帳號驗收與目錄提交分別進行。

## 自行部署

需要 Node.js 24、PostgreSQL、Clerk OAuth 應用程式及 WHOOP 開發者應用程式。

```sh
npm ci
cp .env.example .env.local
# 填入自己的設定，請勿提交金鑰
npx prisma migrate deploy
npm run dev
```

WHOOP 回呼：`<APP_URL>/api/auth/whoop/callback`；Webhook：`<APP_URL>/api/webhooks/whoop`。Clerk 公開 OAuth 用戶端須啟用 PKCE 並設定回呼網址。修改外掛中的服務網址與 OAuth client ID。

驗證：`npm test`、`npm run lint`、`npm run build`。歷史同步支援分頁接續；每日 cron 使用伺服器端金鑰。權杖加密儲存，健康紀錄快取於資料庫；外掛查詢的資料會回傳至目前的 ChatGPT 或 Codex 對話。

獨立社群專案，與 WHOOP 無關聯或背書。教練建議供資訊參考，不提供醫療診斷。
