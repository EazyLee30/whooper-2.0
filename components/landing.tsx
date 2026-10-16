"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import * as Accordion from "@radix-ui/react-accordion";
import {
  ArrowUpRight,
  ArrowRight,
  Activity,
  Moon,
  Heart,
  Dumbbell,
  UserRound,
  Ruler,
  ShieldCheck,
  ChevronDown,
  Code2,
  Sparkles,
  Check,
  Copy,
} from "lucide-react";
const content = {
  en: {
    nav: ["Capabilities", "How it works", "Questions"],
    sign: "Connect account",
    badge: "YOUR BODY. BETTER UNDERSTOOD.",
    title: ["Your recovery.", "A clearer tomorrow."],
    intro:
      "Turn your WHOOP data into a conversation worth having. Explore your sleep, recovery and training with an AI coach that knows your context.",
    cta: "Connect your WHOOP",
    secondary: "Explore the experience",
    note: "Read-only access · Your account, your data",
    sample: "ILLUSTRATIVE PREVIEW · NOT LIVE DATA",
    recovery: "Recovery",
    sleep: "Sleep",
    strain: "Strain",
    question: "How should I train today?",
    answer:
      "Start with your recovery and recent sleep. Look at the trend, then choose a session that fits your readiness.",
    bridge: "WHOOP → WHOOPER → YOUR AI",
    heading: "Every signal. A fuller picture.",
    desc: "Six data domains, preserved from the original Whooper GPT. Look beyond a single score.",
    domains: [
      "Recovery",
      "Sleep",
      "Daily cycles",
      "Workouts",
      "Profile",
      "Body measurements",
    ],
    details: [
      "HRV, resting heart rate and readiness.",
      "Sleep stages, efficiency and sleep need.",
      "Daily strain and physiological context.",
      "Activity, heart-rate zones and training load.",
      "Your WHOOP profile and account context.",
      "Height, weight and maximum heart rate.",
    ],
    how: "From your wrist to your conversation.",
    steps: ["Sign in", "Connect WHOOP", "Bring your AI"],
    stepdetails: [
      "Create your Whooper account securely.",
      "Authorize the six original read-only data scopes.",
      "Use the plugin package and authenticated MCP endpoint.",
    ],
    security: "Built around your boundaries.",
    secdetails:
      "Encrypted OAuth tokens. Authenticated tools. Read-only WHOOP access. Manage your connection and delete stored Whooper data from your account.",
    faq: "A few things to know.",
    questions: [
      "Can everyone use it today?",
      "Does Whooper change my WHOOP data?",
      "How do I connect an AI client?",
    ],
    answers: [
      "The website and source are public. WHOOP is currently in Sandbox with a 10-member limit; wider access needs WHOOP approval. Plugin directory publication is still pending.",
      "No. All WHOOP tools are read-only. You can manage your connection and delete data stored by Whooper in account settings.",
      "Download the plugin package from GitHub. The remote MCP endpoint uses OAuth; client support and installation steps vary. See the setup guide for current verified status.",
    ],
    end: "Make sense of your next day.",
    enddesc: "More context for your coach. More clarity for you.",
    privacy: "Privacy",
    guide: "Setup guide",
    footer:
      "Independent project. Not affiliated with WHOOP. Coaching is not medical advice.",
    copy: "Copy endpoint",
    copied: "Copied",
    package: "Get plugin",
  },
  "zh-CN": {
    nav: ["数据能力", "使用步骤", "常见问题"],
    sign: "连接账号",
    badge: "更懂身体，更懂自己",
    title: ["读懂今天的恢复，", "安排更好的明天。"],
    intro:
      "让 WHOOP 数据成为有价值的对话。结合睡眠、恢复与训练记录，获得真正贴合个人状态的教练建议。",
    cta: "连接你的 WHOOP",
    secondary: "了解使用体验",
    note: "只读授权 · 你的账号，你的数据",
    sample: "示例预览 · 非实时数据",
    recovery: "恢复",
    sleep: "睡眠",
    strain: "日负荷",
    question: "我今天适合怎样训练？",
    answer:
      "先看恢复和最近的睡眠，再结合一段时间的趋势，选择符合今天状态的训练。",
    bridge: "WHOOP → WHOOPER → 你的 AI",
    heading: "每一个信号，拼出完整的你。",
    desc: "完整保留原 Whooper GPT 的六类数据能力，看到分数背后的背景。",
    domains: ["恢复", "睡眠", "每日周期", "训练记录", "个人资料", "身体测量"],
    details: [
      "HRV、静息心率与身体准备状态。",
      "睡眠阶段、效率与睡眠需求。",
      "日负荷与生理周期背景。",
      "运动类型、心率区间与训练负荷。",
      "WHOOP 个人资料与账号信息。",
      "身高、体重与最大心率。",
    ],
    how: "从手腕，到你的对话。",
    steps: ["登录账号", "连接 WHOOP", "接入 AI"],
    stepdetails: [
      "安全创建 Whooper 账号。",
      "授权原有六类数据的只读访问。",
      "通过插件包与经授权的 MCP 接口使用。",
    ],
    security: "数据边界，由你掌握。",
    secdetails:
      "OAuth 令牌加密存储，工具调用需要身份验证，WHOOP 数据只读。你可在账号设置管理连接并删除 Whooper 存储的数据。",
    faq: "开始前，你可能想知道。",
    questions: [
      "现在所有人都能使用吗？",
      "Whooper 会修改 WHOOP 数据吗？",
      "怎么接入 AI 客户端？",
    ],
    answers: [
      "网站和源码已公开。WHOOP 当前处于 Sandbox，限制为 10 位成员；扩大开放需要 WHOOP 审核。插件目录发布仍待完成。",
      "不会。WHOOP 工具均为只读，你可在账号设置管理连接，并删除 Whooper 保存的数据。",
      "从 GitHub 下载插件包。远程 MCP 接口使用 OAuth；客户端支持和安装步骤有所不同，请查看接入指南中的验收状态。",
    ],
    end: "让明天的选择更清晰。",
    enddesc: "给教练更完整的背景，给自己更明确的方向。",
    privacy: "隐私说明",
    guide: "接入指南",
    footer: "独立项目，与 WHOOP 官方无隶属关系。教练建议不替代医疗意见。",
    copy: "复制接口",
    copied: "已复制",
    package: "获取插件",
  },
  "zh-TW": {
    nav: ["資料能力", "使用步驟", "常見問題"],
    sign: "連接帳號",
    badge: "更懂身體，更懂自己",
    title: ["讀懂今天的恢復，", "安排更好的明天。"],
    intro:
      "讓 WHOOP 資料成為有價值的對話。結合睡眠、恢復與訓練紀錄，獲得貼合個人狀態的教練建議。",
    cta: "連接你的 WHOOP",
    secondary: "了解使用體驗",
    note: "唯讀授權 · 你的帳號，你的資料",
    sample: "範例預覽 · 非即時資料",
    recovery: "恢復",
    sleep: "睡眠",
    strain: "日負荷",
    question: "我今天適合怎樣訓練？",
    answer:
      "先看恢復和最近的睡眠，再結合一段時間的趨勢，選擇符合今天狀態的訓練。",
    bridge: "WHOOP → WHOOPER → 你的 AI",
    heading: "每一個訊號，拼出完整的你。",
    desc: "完整保留原 Whooper GPT 的六類資料能力，看到分數背後的背景。",
    domains: ["恢復", "睡眠", "每日週期", "訓練紀錄", "個人資料", "身體測量"],
    details: [
      "HRV、靜息心率與身體準備狀態。",
      "睡眠階段、效率與睡眠需求。",
      "日負荷與生理週期背景。",
      "運動類型、心率區間與訓練負荷。",
      "WHOOP 個人資料與帳號資訊。",
      "身高、體重與最大心率。",
    ],
    how: "從手腕，到你的對話。",
    steps: ["登入帳號", "連接 WHOOP", "接入 AI"],
    stepdetails: [
      "安全建立 Whooper 帳號。",
      "授權原有六類資料的唯讀存取。",
      "透過插件包與經授權的 MCP 介面使用。",
    ],
    security: "資料邊界，由你掌握。",
    secdetails:
      "OAuth 權杖加密儲存，工具呼叫需要身分驗證，WHOOP 資料唯讀。你可在帳號設定管理連接並刪除 Whooper 儲存的資料。",
    faq: "開始前，你可能想知道。",
    questions: [
      "現在所有人都能使用嗎？",
      "Whooper 會修改 WHOOP 資料嗎？",
      "怎麼接入 AI 用戶端？",
    ],
    answers: [
      "網站和原始碼已公開。WHOOP 目前處於 Sandbox，限制為 10 位成員；擴大開放需要 WHOOP 審核。插件目錄發佈仍待完成。",
      "不會。WHOOP 工具均為唯讀，你可在帳號設定管理連接，並刪除 Whooper 保存的資料。",
      "從 GitHub 下載插件包。遠端 MCP 介面使用 OAuth；用戶端支援與安裝步驟有所不同，請查看接入指南中的驗收狀態。",
    ],
    end: "讓明天的選擇更清晰。",
    enddesc: "給教練更完整的背景，給自己更明確的方向。",
    privacy: "隱私說明",
    guide: "接入指南",
    footer: "獨立專案，與 WHOOP 官方無隸屬關係。教練建議不替代醫療意見。",
    copy: "複製介面",
    copied: "已複製",
    package: "取得插件",
  },
};
const icons = [Heart, Moon, Activity, Dumbbell, UserRound, Ruler];
export default function Landing() {
  const [lang, setLang] = useState<keyof typeof content>("en");
  const [copied, setCopied] = useState(false);
  const t = content[lang];
  return (
    <div className="landing" lang={lang}>
      <nav className="site-nav">
        <Link href="/" className="brand">
          <Image src="/icon.png" width={36} height={36} alt="" />
          whooper<span className="beta">BETA</span>
        </Link>
        <div className="nav-links">
          {t.nav.map((n, i) => (
            <a key={n} href={["#capabilities", "#how", "#faq"][i]}>
              {n}
            </a>
          ))}
        </div>
        <div className="nav-actions">
          <select
            aria-label="Language"
            value={lang}
            onChange={(e) => setLang(e.target.value as keyof typeof content)}
          >
            <option value="en">EN</option>
            <option value="zh-CN">简中</option>
            <option value="zh-TW">繁中</option>
          </select>
          <Link className="btn small" href="/settings/connections">
            {t.sign}
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </nav>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="kicker">
              <span className="live-dot" />
              {t.badge}
            </span>
            <h1>
              {t.title[0]}
              <br />
              <em>{t.title[1]}</em>
            </h1>
            <p>{t.intro}</p>
            <div className="cta-row">
              <Link className="btn" href="/settings/connections">
                {t.cta}
                <ArrowUpRight size={18} />
              </Link>
              <a className="text-link" href="#how">
                {t.secondary}
                <ArrowRight size={17} />
              </a>
            </div>
            <div className="trust">
              <ShieldCheck size={16} />
              {t.note}
            </div>
          </div>
          <div className="preview">
            <div className="preview-top">
              <span>
                <Activity size={16} /> WHOOPER / DAILY CONTEXT
              </span>
              <span className="preview-day">TODAY</span>
            </div>
            <div className="score-layout">
              <div className="score-ring">
                <div>
                  <strong>
                    86<span>%</span>
                  </strong>
                  <span>{t.recovery}</span>
                </div>
              </div>
              <div className="mini-stats">
                <div>
                  <Moon size={16} />
                  <span>{t.sleep}</span>
                  <strong>7h 42m</strong>
                  <div className="mini-track">
                    <i />
                  </div>
                </div>
                <div>
                  <Activity size={16} />
                  <span>{t.strain}</span>
                  <strong>
                    12.4<span> / 21</span>
                  </strong>
                  <div className="mini-track strain">
                    <i />
                  </div>
                </div>
              </div>
            </div>
            <div className="week-bars" aria-hidden="true">
              {[44, 65, 51, 79, 60, 91, 86].map((v, i) => (
                <div key={i}>
                  <i style={{ height: v + "%" }} />
                  <span>{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
                </div>
              ))}
            </div>
            <div className="conversation">
              <div className="question">
                {t.question}
                <ArrowUpRight size={16} />
              </div>
              <div className="answer">
                <Sparkles size={18} />
                <p>{t.answer}</p>
              </div>
            </div>
            <div className="sample-label">{t.sample}</div>
          </div>
        </section>
        <div className="client-strip">
          <span>{t.bridge}</span>
          <div>
            ChatGPT <span>✳</span> Codex <span>✳</span> MCP
          </div>
          <span>14 TOOLS / 6 DOMAINS</span>
        </div>
        <section className="section" id="capabilities">
          <div className="section-top">
            <span className="kicker">01 / YOUR CONTEXT</span>
            <h2>{t.heading}</h2>
            <p>{t.desc}</p>
          </div>
          <div className="domain-grid">
            {t.domains.map((name, i) => {
              const Icon = icons[i];
              return (
                <article className="domain" key={name}>
                  <div className="domain-icon">
                    <Icon size={23} />
                  </div>
                  <span className="domain-number">0{i + 1}</span>
                  <h3>{name}</h3>
                  <p>{t.details[i]}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="section how" id="how">
          <div className="section-top">
            <span className="kicker">02 / A SIMPLE CONNECTION</span>
            <h2>{t.how}</h2>
          </div>
          <div className="steps">
            {t.steps.map((s, i) => (
              <article key={s}>
                <span className="step-number">0{i + 1}</span>
                <h3>{s}</h3>
                <p>{t.stepdetails[i]}</p>
              </article>
            ))}
          </div>
          <div className="endpoint">
            <code>https://whooper.eazylee.si/api/mcp</code>
            <button
              className="copy-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    "https://whooper.eazylee.si/api/mcp",
                  );
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
              {copied ? t.copied : t.copy}
            </button>
          </div>
          <a
            className="text-link"
            href="https://github.com/EazyLee30/whooper-2.0/blob/main/SETUP_CHECKLIST.md"
          >
            {t.guide}
            <ArrowUpRight size={16} />
          </a>
        </section>
        <section className="security">
          <div className="security-art">
            <ShieldCheck size={74} strokeWidth={1} />
            <span>READ ONLY</span>
          </div>
          <div>
            <span className="kicker">03 / TRUST BY DESIGN</span>
            <h2>{t.security}</h2>
            <p>{t.secdetails}</p>
            <Link className="text-link" href="/privacy">
              {t.privacy}
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
        <section className="section faq" id="faq">
          <div>
            <span className="kicker">04 / GOOD TO KNOW</span>
            <h2>{t.faq}</h2>
          </div>
          <Accordion.Root type="single" collapsible className="accordion">
            {t.questions.map((q, i) => (
              <Accordion.Item value={String(i)} key={q}>
                <Accordion.Header>
                  <Accordion.Trigger>
                    {q}
                    <ChevronDown size={18} />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>
                  <p>{t.answers[i]}</p>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </section>
        <section className="final-cta">
          <span className="kicker">THE NEXT CHAPTER IS YOURS</span>
          <h2>{t.end}</h2>
          <p>{t.enddesc}</p>
          <Link className="btn" href="/settings/connections">
            {t.cta}
            <ArrowUpRight size={18} />
          </Link>
          <a
            className="text-link"
            href="https://github.com/EazyLee30/whooper-2.0/releases/tag/v0.2.1"
          >
            {t.package}
            <ArrowUpRight size={16} />
          </a>
        </section>
      </main>
      <footer className="site-footer">
        <Link className="brand" href="/">
          whooper
        </Link>
        <p>{t.footer}</p>
        <Link href="/privacy">{t.privacy}</Link>
        <a href="https://github.com/EazyLee30/whooper-2.0" aria-label="GitHub">
          <Code2 size={20} />
        </a>
      </footer>
    </div>
  );
}
