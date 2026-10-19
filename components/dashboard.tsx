"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Dumbbell,
  ExternalLink,
  Heart,
  LayoutGrid,
  Link2,
  LoaderCircle,
  Moon,
  RefreshCw,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { TEMPLATES, type TemplateId } from "@/lib/presentation";
import type {
  DashboardData,
  ShareRecord,
  ShareSnapshot,
} from "@/lib/dashboard/types";
import type { PublicStrength } from "@/lib/public-workout/strength-data";
import { DEMO_DASHBOARD, DEMO_STRENGTH } from "@/lib/dashboard/demo";
import { WorkoutPresentation } from "./workout-presentation";
import { ThemePicker, useTheme } from "./theme-picker";
import "./dashboard.css";

const views = [
  { id: "overview", label: "数据总览", english: "Overview", icon: LayoutGrid },
  { id: "workouts", label: "训练记录", english: "Workouts", icon: Dumbbell },
  {
    id: "library",
    label: "分享页面库",
    english: "Share studio",
    icon: Sparkles,
  },
  { id: "shares", label: "我的分享", english: "My links", icon: Link2 },
] as const;
type View = (typeof views)[number]["id"];
const isView = (value: unknown): value is View =>
  views.some((view) => view.id === value);
const number = (value: number | null | undefined, digits = 0) =>
  value == null
    ? "—"
    : value.toLocaleString("en-US", { maximumFractionDigits: digits });
const shortDate = (date: string) => date.slice(5).replace("-", ".");
const demoWorkout =
  DEMO_DASHBOARD.workouts.find(
    (workout) => workout.id === DEMO_STRENGTH.activity_id,
  ) ?? DEMO_DASHBOARD.workouts[0];
const exampleSnapshot: ShareSnapshot = {
  version: 1,
  title: "把每一次重复，留在纸上。",
  workout: demoWorkout,
  strength: DEMO_STRENGTH,
};

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : "暂时无法完成，请稍后重试。",
    );
  return body as T;
}

export default function Dashboard({ initialView }: { initialView?: string }) {
  const [view, setView] = useState<View>(
    isView(initialView) ? initialView : "overview",
  );
  const { theme, setTheme } = useTheme();
  const [data, setData] = useState<DashboardData | null>(null);
  const [date, setDate] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [strengthResult, setStrengthResult] = useState<{
    id: string;
    session: PublicStrength | null;
    error?: string;
  } | null>(null);
  const [template, setTemplate] = useState<TemplateId>("ledger");
  const [title, setTitle] = useState("我的训练记录");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [createdUrl, setCreatedUrl] = useState("");
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [sharesError, setSharesError] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [evaluatedAt, setEvaluatedAt] = useState(0);
  const [exporting, setExporting] = useState(false);
  const preview = useRef<HTMLDialogElement>(null);
  const exportContent = useRef<HTMLDivElement>(null);
  const configRevision = useRef(0);
  const selected =
    data?.workouts.find((workout) => workout.id === selectedId) ??
    data?.workouts[0] ??
    null;
  const strength =
    strengthResult && strengthResult.id === selected?.id
      ? strengthResult.session
      : null;
  const strengthLoading =
    !!selected &&
    !!data?.strengthConnected &&
    strengthResult?.id !== selected.id;
  const strengthError =
    strengthResult && strengthResult.id === selected?.id
      ? strengthResult.error
      : undefined;
  const snapshot: ShareSnapshot = selected
    ? { version: 1, title, workout: selected, strength }
    : exampleSnapshot;

  function navigate(next: View) {
    if (next === view) return;
    if (next === "shares") setSharesLoading(true);
    setView(next);
    setMessage("");
    window.history.replaceState(
      null,
      "",
      `/dashboard${next === "overview" ? "" : `?view=${next}`}`,
    );
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/dashboard${date ? `?date=${encodeURIComponent(date)}` : ""}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => responseJson<DashboardData>(response))
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(reason.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, refresh]);
  const workoutId = selected?.id;
  const strengthConnected = data?.strengthConnected;
  useEffect(() => {
    if (!workoutId || !strengthConnected) return;
    const controller = new AbortController();
    fetch(`/api/dashboard/strength?workout=${encodeURIComponent(workoutId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) =>
        responseJson<{ session: PublicStrength | null }>(response),
      )
      .then((result) =>
        setStrengthResult({ id: workoutId, session: result.session }),
      )
      .catch((reason) => {
        if (!controller.signal.aborted)
          setStrengthResult({
            id: workoutId,
            session: null,
            error: reason.message,
          });
      });
    return () => controller.abort();
  }, [workoutId, strengthConnected, refresh]);
  useEffect(() => {
    if (view !== "shares") return;
    const controller = new AbortController();
    fetch("/api/shares", { signal: controller.signal, cache: "no-store" })
      .then((response) => responseJson<{ shares: ShareRecord[] }>(response))
      .then((result) => {
        setShares(result.shares);
        setEvaluatedAt(Date.now());
        setSharesError("");
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setSharesError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSharesLoading(false);
      });
    return () => controller.abort();
  }, [view, refresh]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(""), 2200);
    } catch {
      setMessage("复制失败，可选中下方链接手动复制。");
    }
  }
  async function createShare() {
    if (!selected || creating || loading || strengthLoading) return;
    const revision = configRevision.current;
    setCreating(true);
    setMessage("");
    setCreatedUrl("");
    try {
      const result = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutId: selected.id,
          template,
          theme,
          title,
        }),
      }).then((response) =>
        responseJson<{ share: ShareRecord; url: string }>(response),
      );
      if (configRevision.current === revision) setCreatedUrl(result.url);
      setShares((items) => [result.share, ...items]);
      setEvaluatedAt(Date.now());
      setMessage(
        configRevision.current === revision
          ? "分享页面已创建，有效期 30 天。"
          : "已按提交时的设置创建页面，可在「我的分享」查看。",
      );
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "创建分享失败，请重试。",
      );
    } finally {
      setCreating(false);
    }
  }
  async function revoke(id: string) {
    setRevoking(id);
    setSharesError("");
    try {
      await fetch(`/api/shares/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }).then((response) => responseJson(response));
      setShares((items) =>
        items.map((item) =>
          item.id === id
            ? { ...item, revokedAt: new Date().toISOString() }
            : item,
        ),
      );
    } catch (reason) {
      setSharesError(
        reason instanceof Error ? reason.message : "撤销失败，请重试。",
      );
    } finally {
      setRevoking(null);
    }
  }
  async function saveImage() {
    if (!selected || loading || !exportContent.current || exporting) return;
    setExporting(true);
    setMessage("");
    try {
      const { exportWorkoutImage } = await import("@/lib/export-workout");
      const element = exportContent.current.querySelector<HTMLElement>(".wp");
      if (!element) return;
      await exportWorkoutImage(element, template, selected.date);
      setMessage("训练图片已导出。");
    } catch {
      setMessage("图片导出失败，请重试。");
    } finally {
      setExporting(false);
    }
  }
  function invalidateShare() {
    configRevision.current += 1;
    setCreatedUrl("");
    setMessage("");
  }
  function changeTheme(value: Parameters<typeof setTheme>[0]) {
    setTheme(value);
    invalidateShare();
  }
  function pickWorkout(id: string) {
    setSelectedId(id);
    invalidateShare();
  }
  const refreshData = () => {
    setLoading(true);
    setStrengthResult(null);
    setRefresh((value) => value + 1);
  };
  const activeView = views.find((item) => item.id === view)!;
  const trainingCount =
    data?.week.filter((day) => day.trained === true).length ?? 0;
  const totalMinutes =
    data?.workouts.reduce((sum, workout) => sum + workout.durationMin, 0) ?? 0;

  return (
    <div className="dashboard" data-theme={theme} lang="zh-CN">
      <a className="dash-skip" href="#dashboard-content">
        跳到主要内容
      </a>
      <aside className="dash-sidebar">
        <Link href="/dashboard" className="dash-brand">
          <span className="dash-brand-mark">
            <Activity size={19} />
          </span>
          whooper<span className="dash-beta">BETA</span>
        </Link>
        <div className="dash-sidebar-label">YOUR PERSONAL SPACE</div>
        <nav aria-label="工作台导航">
          {views.map((item) => (
            <button
              key={item.id}
              className={`dash-nav-item ${view === item.id ? "is-active" : ""}`}
              aria-current={view === item.id ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
              {view === item.id ? <span className="dash-nav-dot" /> : null}
            </button>
          ))}
        </nav>
        <div className="dash-sidebar-note">
          <span className="dash-sidebar-note-symbol">↗</span>
          <strong>你的训练，你的表达。</strong>
          <p>
            让数据有自己的样子。
            <br />
            从一次训练，留下一页记录。
          </p>
          <button onClick={() => navigate("library")}>
            探索分享模板 <ArrowRight size={14} />
          </button>
        </div>
        <div className="dash-sidebar-bottom">
          <Link href="/settings/connections">
            <Settings2 size={17} />
            账号与连接
            <ArrowUpRight size={13} />
          </Link>
          <div className="dash-account">
            <UserButton />
            <span>
              个人工作台<small>PRIVATE BY DEFAULT</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="dash-main">
        <header className="dash-topbar">
          <div className="dash-breadcrumb">
            我的空间 <ChevronRight size={13} />
            <span>{activeView.label}</span>
          </div>
          <div className="dash-topbar-actions">
            <span className="dash-connection">
              <i
                className={data?.connectionStatus === "active" ? "is-live" : ""}
              />
              {data?.connectionStatus === "active"
                ? "WHOOP 已连接"
                : "私人工作台"}
            </span>
            <ThemePicker theme={theme} onChange={changeTheme} />
          </div>
        </header>
        <main id="dashboard-content" className="dash-content">
          <div className="dash-page-heading">
            <div>
              <span className="dash-overline">
                {activeView.english.toUpperCase()} / WHOOPER
              </span>
              <h1>
                {view === "overview"
                  ? "每一次训练，都有迹可循。"
                  : view === "workouts"
                    ? "把投入，记下来。"
                    : view === "library"
                      ? "训练是你的，风格也是。"
                      : "分享，掌握在你手里。"}
              </h1>
              <p>
                {view === "overview"
                  ? "看见身体的节奏，也留住每一次认真。"
                  : view === "workouts"
                    ? "选择一次训练，查看细节，以自己的方式分享。"
                    : view === "library"
                      ? "同一份训练记录，四种不同表达。选一个你喜欢的。"
                      : "每一个链接都是独立快照，可随时撤销。"}
              </p>
            </div>
            <span className="dash-page-index">
              0{views.findIndex((item) => item.id === view) + 1}
              <small>/ 04</small>
            </span>
          </div>
          {error ? (
            <div className="dash-alert" role="alert">
              <span>{error}</span>
              <button onClick={refreshData}>
                重新读取 <RefreshCw size={13} />
              </button>
            </div>
          ) : null}
          {data?.notice ? (
            <p className="dash-data-notice">{data.notice}</p>
          ) : null}
          {data && data.connectionStatus !== "active" ? (
            <div className="dash-connect-card">
              <span className="dash-connect-icon">
                <Activity size={28} />
              </span>
              <div>
                <strong>
                  {data.connectionStatus === "reauth_required"
                    ? "重新连接，继续你的记录。"
                    : "从连接你的 WHOOP 开始。"}
                </strong>
                <p>恢复、睡眠和训练，在一个属于你的空间里汇合。</p>
              </div>
              <Link className="dash-button" href="/settings/connections">
                连接 WHOOP <ArrowUpRight size={16} />
              </Link>
            </div>
          ) : null}

          {view === "overview" || view === "workouts" ? (
            <>
              <div className="dash-date-row">
                <span>
                  {data?.date
                    ? `${data.date.replaceAll("-", ".")} · ${data.timezone}`
                    : "YOUR DAILY CONTEXT"}
                </span>
                <div>
                  <label className="dash-date-input">
                    <span>查看日期</span>
                    <input
                      aria-label="查看日期"
                      type="date"
                      value={date || data?.date || ""}
                      onChange={(event) => {
                        if (event.target.value) {
                          setLoading(true);
                          setDate(event.target.value);
                          invalidateShare();
                        }
                      }}
                    />
                  </label>
                  <button
                    className="dash-icon-button"
                    disabled={loading}
                    onClick={refreshData}
                    aria-label="刷新数据"
                  >
                    <RefreshCw
                      size={16}
                      className={loading ? "dash-spin" : ""}
                    />
                  </button>
                </div>
              </div>
              {view === "overview" ? (
                <>
                  <section
                    className="dash-metrics"
                    aria-label="当天身体数据"
                    aria-busy={loading}
                  >
                    <Metric
                      icon={Heart}
                      label="恢复指数"
                      value={number(data?.metrics.recovery)}
                      unit="%"
                      caption="RECOVERY"
                      tone="green"
                      loading={loading}
                    />
                    <Metric
                      icon={Moon}
                      label="睡眠时长"
                      value={number(data?.metrics.sleepHours, 1)}
                      unit="h"
                      caption="SLEEP"
                      tone="purple"
                      loading={loading}
                    />
                    <Metric
                      icon={Activity}
                      label="当日负荷"
                      value={number(data?.metrics.strain, 1)}
                      unit="/ 21"
                      caption="DAY STRAIN"
                      tone="orange"
                      loading={loading}
                    />
                    <Metric
                      icon={Clock3}
                      label="本周训练时长"
                      value={number(totalMinutes)}
                      unit="min"
                      caption="LAST 7 DAYS"
                      tone="blue"
                      loading={loading}
                    />
                  </section>
                  <div className="dash-overview-grid">
                    <section className="dash-panel dash-week-panel">
                      <div className="dash-panel-heading">
                        <div>
                          <span className="dash-overline">
                            THE RHYTHM OF YOUR WEEK
                          </span>
                          <h2>找到自己的节奏。</h2>
                        </div>
                        <span className="dash-chip">近 7 天</span>
                      </div>
                      <div className="dash-week-summary">
                        <strong>
                          {loading ? "—" : trainingCount}
                          <small> / 7 天</small>
                        </strong>
                        <span>有训练记录</span>
                      </div>
                      <div
                        className="dash-week-chart"
                        aria-label="最近七天训练与负荷"
                      >
                        {(
                          data?.week ??
                          Array.from({ length: 7 }, (_, i) => ({
                            date: `0000-00-0${i + 1}`,
                            trained: null,
                            strain: null,
                          }))
                        ).map((day, index) => (
                          <div
                            key={day.date}
                            className={`dash-week-day ${day.trained ? "is-trained" : ""} ${index === 6 ? "is-today" : ""}`}
                          >
                            <span>
                              {day.strain == null ? "—" : number(day.strain, 1)}
                            </span>
                            <div className="dash-bar-track">
                              <i
                                style={{
                                  height:
                                    day.strain == null
                                      ? "3px"
                                      : `${Math.max(4, Math.min(100, (day.strain / 21) * 100))}%`,
                                }}
                              />
                            </div>
                            <small>{loading ? "·" : shortDate(day.date)}</small>
                            <i
                              className="dash-day-dot"
                              title={
                                day.trained === null
                                  ? "暂无数据"
                                  : day.trained
                                    ? "已训练"
                                    : "无训练记录"
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <div className="dash-chart-legend">
                        <span>
                          <i />
                          每日负荷
                        </span>
                        <span>
                          <i />
                          有训练记录
                        </span>
                      </div>
                    </section>
                    <section className="dash-panel dash-feature-template">
                      <div className="dash-panel-heading">
                        <span className="dash-overline">
                          YOUR EFFORT, YOUR EXPRESSION
                        </span>
                        <ArrowUpRight size={18} />
                      </div>
                      <div className="dash-mini-sheet" aria-hidden="true">
                        <span>PERSONAL TRAINING RECORD</span>
                        <strong>Exercise List</strong>
                        <div>
                          <span>EXERCISE</span>
                          <span>SETS</span>
                          <span>REPS</span>
                        </div>
                        {["Pull up", "Seated row", "Lat pulldown"].map(
                          (name, i) => (
                            <div key={name}>
                              <i>{name}</i>
                              <i>3</i>
                              <i>{8 + i * 2}</i>
                            </div>
                          ),
                        )}
                        <small>EVERY REP COUNTS.</small>
                      </div>
                      <div className="dash-feature-copy">
                        <h2>让记录，成为作品。</h2>
                        <p>手写训练单、动作图鉴，还有更多。</p>
                        <button
                          className="dash-text-button"
                          onClick={() => navigate("library")}
                        >
                          打开分享页面库 <ArrowRight size={15} />
                        </button>
                      </div>
                    </section>
                  </div>
                </>
              ) : null}
              <section className="dash-workouts-section">
                <div className="dash-section-heading">
                  <div>
                    <span className="dash-overline">THE WORK YOU PUT IN</span>
                    <h2>
                      训练记录<span>{data?.workouts.length ?? 0}</span>
                    </h2>
                  </div>
                  {view === "overview" ? (
                    <button
                      className="dash-text-button"
                      onClick={() => navigate("workouts")}
                    >
                      查看全部 <ArrowUpRight size={14} />
                    </button>
                  ) : (
                    <span className="dash-muted">选择训练以查看详情</span>
                  )}
                </div>
                {loading ? (
                  <div className="dash-empty" aria-busy="true">
                    <LoaderCircle className="dash-spin" size={23} />
                    <p>正在读取你的训练记录…</p>
                  </div>
                ) : !data?.workouts.length ? (
                  <div className="dash-empty">
                    <Dumbbell size={26} />
                    <h3>这段时间还没有训练记录。</h3>
                    <p>
                      {data?.connectionStatus === "active"
                        ? "可切换日期，或在账号与连接中同步 WHOOP 历史数据。"
                        : "连接 WHOOP 后，你的真实训练会显示在这里。"}
                    </p>
                    <Link
                      className="dash-text-button"
                      href="/settings/connections"
                    >
                      管理连接与同步 <ArrowUpRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <div className="dash-workout-list">
                    {data.workouts.map((workout) => (
                      <button
                        key={workout.id}
                        className={`dash-workout-row ${selected?.id === workout.id ? "is-selected" : ""}`}
                        onClick={() => pickWorkout(workout.id)}
                        aria-pressed={selected?.id === workout.id}
                      >
                        <span className="dash-workout-icon">
                          {/run|跑|walk|步|cycl|骑/i.test(workout.name) ? (
                            <Activity size={20} />
                          ) : (
                            <Dumbbell size={20} />
                          )}
                        </span>
                        <span className="dash-workout-name">
                          <strong>{workout.name}</strong>
                          <small>
                            {shortDate(workout.date)} <span>·</span>{" "}
                            {new Date(workout.start).toLocaleTimeString(
                              "zh-CN",
                              {
                                timeZone: data.timezone,
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </small>
                        </span>
                        <span className="dash-workout-stat">
                          <strong>
                            {number(workout.durationMin)}
                            <small> min</small>
                          </strong>
                          <span>训练时长</span>
                        </span>
                        <span className="dash-workout-stat">
                          <strong>{number(workout.strain, 1)}</strong>
                          <span>运动负荷</span>
                        </span>
                        <span className="dash-workout-arrow">
                          <ArrowDownLeft size={17} />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
              {selected ? (
                <section className="dash-session-section">
                  <div className="dash-section-heading">
                    <div>
                      <span className="dash-overline">A CLOSER LOOK</span>
                      <h2>这一次训练</h2>
                    </div>
                    <button
                      className="dash-button"
                      onClick={() => navigate("library")}
                    >
                      <Share2 size={14} />
                      选择分享样式
                    </button>
                  </div>
                  {strengthLoading ? (
                    <p className="dash-inline-loading">
                      <LoaderCircle size={15} className="dash-spin" />
                      正在读取 Strength Trainer 明细…
                    </p>
                  ) : null}
                  {strengthError ? (
                    <p className="dash-data-notice" role="status">
                      力量训练明细读取失败。
                      <button
                        className="dash-text-button"
                        onClick={refreshData}
                      >
                        重试
                      </button>
                    </p>
                  ) : null}
                  {!data?.strengthConnected ? (
                    <p className="dash-data-notice">
                      连接 Strength Trainer 可查看每个动作的组数、次数与重量。
                      <Link href="/settings/connections">前往连接 ↗</Link>
                    </p>
                  ) : null}
                  <WorkoutPresentation
                    snapshot={snapshot}
                    template="illustrated"
                  />
                </section>
              ) : null}
            </>
          ) : null}

          {view === "library" ? (
            <>
              <div className="dash-library-toolbar">
                <span>
                  <span className="dash-count">04</span>种表达方式{" "}
                  <span className="dash-library-divider">/</span>{" "}
                  同步你的训练数据
                </span>
                <span className="dash-chip">
                  <ShieldCheck size={12} />
                  创建前仅自己可见
                </span>
              </div>
              <section className="dash-template-grid" aria-label="分享页面模板">
                {TEMPLATES.map((item) => (
                  <button
                    className={`dash-template-card ${template === item.id ? "is-selected" : ""}`}
                    key={item.id}
                    aria-pressed={template === item.id}
                    onClick={() => {
                      setTemplate(item.id);
                      invalidateShare();
                    }}
                  >
                    <div className="dash-template-thumbnail">
                      <WorkoutPresentation
                        snapshot={snapshot}
                        template={item.id}
                        compact
                      />
                      <span className="dash-template-number">
                        {item.number}
                      </span>
                    </div>
                    <div className="dash-template-card-copy">
                      <span className="dash-template-category">
                        {item.category}
                      </span>
                      <h2>
                        {item.name}
                        {template === item.id ? (
                          <Check size={18} />
                        ) : (
                          <ArrowUpRight size={18} />
                        )}
                      </h2>
                      <p>{item.description}</p>
                    </div>
                  </button>
                ))}
              </section>
              <section className="dash-studio">
                <div className="dash-studio-settings">
                  <span className="dash-overline">MAKE A PAGE OF YOUR OWN</span>
                  <h2>留下你的这一页。</h2>
                  <p>选择训练和外观，生成一个可分享的只读页面。</p>
                  <label>
                    训练记录
                    <select
                      value={selected?.id ?? ""}
                      onChange={(event) => pickWorkout(event.target.value)}
                      disabled={!data?.workouts.length}
                    >
                      <option value="" disabled>
                        {loading ? "正在读取…" : "暂无可分享训练"}
                      </option>
                      {data?.workouts.map((workout) => (
                        <option key={workout.id} value={workout.id}>
                          {workout.date} · {workout.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    页面标题
                    <input
                      maxLength={80}
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value);
                        invalidateShare();
                      }}
                      placeholder="给这次训练起个标题"
                    />
                  </label>
                  <div className="dash-share-summary">
                    <span>
                      模板
                      <strong>
                        {TEMPLATES.find((item) => item.id === template)?.name}
                      </strong>
                    </span>
                    <span>
                      外观
                      <ThemePicker theme={theme} onChange={changeTheme} />
                    </span>
                  </div>
                  <div className="dash-share-privacy">
                    <ShieldCheck size={17} />
                    <p>
                      仅分享本次训练及动作记录。恢复、睡眠、心率和账号资料留在你的私人空间。链接
                      30 天后失效，也可随时撤销。
                    </p>
                  </div>
                  <button
                    className="dash-button dash-create-button"
                    onClick={createShare}
                    disabled={
                      !selected ||
                      loading ||
                      creating ||
                      strengthLoading ||
                      !!strengthError ||
                      !title.trim()
                    }
                  >
                    {creating || strengthLoading ? (
                      <LoaderCircle size={16} className="dash-spin" />
                    ) : (
                      <Share2 size={16} />
                    )}
                    {creating
                      ? "正在生成页面…"
                      : strengthLoading
                        ? "正在读取训练…"
                        : "创建分享页面"}
                    <ArrowUpRight size={16} />
                  </button>
                  {!selected ? (
                    <p className="dash-preview-note">
                      模板使用示例数据预览。连接 WHOOP
                      并选择真实训练后可创建分享。
                    </p>
                  ) : null}
                  {strengthError ? (
                    <p className="dash-preview-note" role="status">
                      训练明细读取失败，请返回训练记录重试。
                    </p>
                  ) : null}
                  <p className="dash-action-message" role="status">
                    {message}
                  </p>
                  {createdUrl ? (
                    <div className="dash-created-link">
                      <input
                        aria-label="已生成的分享链接"
                        readOnly
                        value={createdUrl}
                        onFocus={(event) => event.target.select()}
                      />
                      <div>
                        <button
                          className="dash-text-button"
                          onClick={() => copy(createdUrl)}
                        >
                          {copied === createdUrl ? (
                            <Check size={14} />
                          ) : (
                            <Copy size={14} />
                          )}
                          {copied === createdUrl ? "已复制" : "复制链接"}
                        </button>
                        <a
                          className="dash-text-button"
                          href={createdUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          打开页面 <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="dash-studio-preview">
                  <div className="dash-preview-heading">
                    <span>
                      {selected ? "你的分享页面预览" : "模板预览 · 示例数据"}
                    </span>
                    <button
                      className="dash-text-button"
                      onClick={() => preview.current?.showModal()}
                    >
                      展开预览 <ArrowUpRight size={13} />
                    </button>
                  </div>
                  <WorkoutPresentation
                    snapshot={snapshot}
                    template={template}
                  />
                </div>
              </section>
            </>
          ) : null}

          {view === "shares" ? (
            <section className="dash-shares-section">
              {sharesError ? (
                <div role="alert" className="dash-alert">
                  <span>{sharesError}</span>
                  <button
                    onClick={() => {
                      setSharesLoading(true);
                      setRefresh((value) => value + 1);
                    }}
                  >
                    重试
                  </button>
                </div>
              ) : null}
              {sharesLoading ? (
                <div className="dash-empty">
                  <LoaderCircle className="dash-spin" size={24} />
                  <p>正在读取分享链接…</p>
                </div>
              ) : !shares.length ? (
                <div className="dash-empty dash-empty-shares">
                  <Link2 size={30} />
                  <h2>第一张分享页面，等你创造。</h2>
                  <p>从训练记录中选择一次训练，再挑选你喜欢的模板。</p>
                  <button
                    className="dash-button"
                    onClick={() => navigate("library")}
                  >
                    探索分享页面库 <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="dash-shares-list">
                  {shares.map((share) => {
                    const expired =
                      new Date(share.expiresAt).getTime() <= evaluatedAt;
                    const inactive = !!share.revokedAt || expired;
                    const url = `${window.location.origin}/share/${share.token}`;
                    return (
                      <article
                        className={`dash-share-row ${inactive ? "is-inactive" : ""}`}
                        key={share.id}
                      >
                        <span className="dash-share-row-icon">
                          <Share2 size={20} />
                        </span>
                        <div>
                          <h2>{share.title}</h2>
                          <p>
                            {
                              TEMPLATES.find(
                                (item) => item.id === share.template,
                              )?.name
                            }{" "}
                            <span>·</span> {share.createdAt.slice(0, 10)} 创建
                          </p>
                          <span className="dash-share-expiry">
                            {share.revokedAt
                              ? "已撤销"
                              : expired
                                ? "已过期"
                                : `有效至 ${share.expiresAt.slice(0, 10)}`}
                          </span>
                        </div>
                        <div className="dash-share-row-actions">
                          {!inactive ? (
                            <>
                              <a
                                className="dash-icon-button"
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`打开 ${share.title}`}
                              >
                                <ExternalLink size={16} />
                              </a>
                              <button
                                className="dash-icon-button"
                                onClick={() => copy(url)}
                                aria-label={`复制 ${share.title} 链接`}
                              >
                                {copied === url ? (
                                  <Check size={16} />
                                ) : (
                                  <Copy size={16} />
                                )}
                              </button>
                              <button
                                className="dash-revoke"
                                disabled={revoking === share.id}
                                onClick={() => revoke(share.id)}
                              >
                                <Trash2 size={14} />
                                {revoking === share.id ? "撤销中…" : "撤销"}
                              </button>
                            </>
                          ) : (
                            <span className="dash-muted">链接已失效</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}
          <footer className="dash-footer">
            <span>YOUR BODY. YOUR DATA. YOUR EXPRESSION.</span>
            <span>
              Whooper <i>↗</i> <Link href="/privacy">隐私说明</Link>
            </span>
          </footer>
        </main>
      </div>
      <dialog
        ref={preview}
        className="dash-full-preview"
        aria-label="分享页面完整预览"
      >
        <div className="dash-full-preview-toolbar">
          <span>{selected ? "分享页面预览" : "示例数据 · 模板预览"}</span>
          <div className="dash-preview-actions">
            {selected &&
            (template === "ledger" || template === "illustrated") ? (
              <button
                className="dash-text-button"
                onClick={saveImage}
                disabled={exporting || loading || strengthLoading}
              >
                {exporting ? (
                  <LoaderCircle size={14} className="dash-spin" />
                ) : (
                  <Download size={14} />
                )}
                {exporting ? "导出中…" : "保存 PNG"}
              </button>
            ) : null}
            <button
              className="dash-icon-button"
              aria-label="关闭预览"
              onClick={() => preview.current?.close()}
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <p className="dash-action-message" role="status">
          {message}
        </p>
        <div ref={exportContent}>
          <WorkoutPresentation snapshot={snapshot} template={template} />
        </div>
      </dialog>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  caption,
  tone,
  loading,
}: {
  icon: typeof Heart;
  label: string;
  value: string;
  unit: string;
  caption: string;
  tone: string;
  loading: boolean;
}) {
  return (
    <article className={`dash-metric dash-metric-${tone}`}>
      <div>
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <strong>
        {loading ? "—" : value}
        <small>{unit}</small>
      </strong>
      <span className="dash-metric-caption">
        {caption}
        <i />
      </span>
    </article>
  );
}
