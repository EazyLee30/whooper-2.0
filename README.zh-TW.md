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

你的恢復、睡眠與訓練教練，提供 ChatGPT 和 Codex 外掛，並支援 Muse 透過認證 MCP 接入。

保留原 GPT 的完整教練指令與六類 WHOOP 資料功能，結合唯讀 MCP 工具、詳細資料查詢、每日快照與歷史涵蓋範圍檢查。每位使用者登入自己的帳號並授權自己的 WHOOP。

**[公開試用](https://whooper.ccwu.cc)** · [下載外掛安裝包](https://github.com/EazyLee30/whooper-2.0/releases/tag/v0.2.1) · [外掛原始碼](plugin) · [隱私說明](https://whooper.ccwu.cc/privacy)

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

MCP 網址：`https://whooper.ccwu.cc/api/mcp`。認證 MCP 用戶端會在初始化回應中取得教練指引，並透過 `tools/list` 探索工具；完整外掛還將指引封裝為 portable skill，並附帶用戶端中繼資料與品牌素材。

**試用狀態：**目前使用 Clerk 開發執行個體；WHOOP 應用程式目前為 Sandbox，最多連接 10 人（2026-10-10 檢查時已連接 1 人）。公開原始碼與提供安裝包不代表已通過通用外掛目錄審核。真實帳號驗收與目錄提交分別進行。

## Muse 支援

Muse 可透過同一認證唯讀 MCP 介面查詢 Whooper。**2026-10-15 已驗證：**OAuth 授權、更新權杖輪替、全部 14 個工具的自動探索、連線狀態、每日快照、睡眠／恢復／訓練詳情、歷史涵蓋範圍及同步狀態；新程序查詢及三個並行 helper 程序也通過測試。

實測方案是在 **Muse 智能體的 VM 內設定本機 helper**，不是 Muse 原生 connector，也不是安裝 portable plugin。helper 與憑證須在該環境個別設定，本儲存庫不包含該腳本。設定完成後，可直接問 Muse：「昨晚睡得怎麼樣？」「比較我的恢復與訓練情況。」

### 接入 Muse

1. 先登入 [Whooper](https://whooper.ccwu.cc)，連接自己的 WHOOP 帳戶。
2. 在 Clerk → Configure → Developers → OAuth applications 中，為 Whooper 使用的公開 OAuth 用戶端登記精確回呼網址 `https://whooper.ccwu.cc/connect/muse`。自行部署時替換網域及 client ID，保留既有回呼網址與授權確認頁。
3. 讓 Muse 為 `https://whooper.ccwu.cc/api/mcp` 設定持久化 MCP helper：產生新的 PKCE S256 verifier/challenge 與隨機 `state`，私下保留 verifier，以 `openid offline_access` 為 scope、MCP 網址為 `resource` 發起授權。授權與權杖端點從授權伺服器的 discovery 文件讀取；公開試用的 client ID 為 `EsrIyDTsryA3lxTL`。
4. 讓 Muse 將授權 URL 放在純文字程式碼區塊，複製到外部瀏覽器網址列，以同一 Whooper 帳號登入並批准。實測 Muse 用戶端直接點擊聊天內的 OAuth 連結會開啟 Accounts 視窗，隨後關閉而未完成流程。
5. 回呼頁顯示一次性授權碼，只交給持有相符 verifier 的可信 Muse 對話。helper 必須驗證 `state`，使用該 verifier 與完全一致的回呼網址交換權杖。這是手動授權碼交接，回呼頁不會自動交換或儲存權杖。
6. 驗證 `initialize`、`tools/list`、`get_connection_status` 及真實 `get_daily_snapshot`。Clerk 憑證私存於 Muse VM，採用僅擁有者可讀寫的權限（如 `0600`）；更新權杖輪替須依序執行並以原子操作儲存新憑證。Access／refresh token 與 verifier 不得寫入聊天、記憶檔或 GitHub。WHOOP 權杖仍由 Whooper 伺服器端加密儲存，查詢出的健康資料會回傳 Muse 對話。

若 Clerk 回報回呼不符，檢查允許清單中的精確網址。若 helper 探索的工具為空，應依 JSON-RPC 請求 ID 解析 Streamable HTTP 的 JSON／SSE 回應，不要預設最後一幀就是結果，並遵循協商後的 MCP 初始化與協定流程。實測服務為無狀態模式，不回傳 `Mcp-Session-Id`。撤銷 Clerk 授權或遺失 VM 憑證後須重新連接 Muse；Muse 授權與 WHOOP 帳戶授權是兩個獨立環節。

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

驗證：`npm test`、`npm run lint`、`npm run build`。歷史同步支援分頁接續；每日 cron 使用伺服器端金鑰。權杖加密儲存，健康紀錄快取於資料庫；查詢的資料會回傳發起請求的 ChatGPT、Codex 或已設定的 Muse 對話。

獨立社群專案，與 WHOOP 無關聯或背書。教練建議供資訊參考，不提供醫療診斷。
