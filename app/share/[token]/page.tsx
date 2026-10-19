import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity } from "lucide-react";
import { getSharedWorkout } from "@/lib/shares/service";
import { WorkoutPresentation } from "@/components/workout-presentation";
import "@/components/dashboard.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "一页训练记录 · Whooper",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function SharedWorkoutPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getSharedWorkout(token);
  if (!result) notFound();
  const { share, snapshot } = result;
  return (
    <div className="dashboard share-page" data-theme={share.theme} lang="zh-CN">
      <nav className="share-topbar">
        <Link className="dash-brand" href="/">
          <span className="dash-brand-mark">
            <Activity size={17} />
          </span>
          whooper
        </Link>
        <span>A PAGE FROM MY TRAINING LIFE</span>
      </nav>
      <main className="share-content">
        <h1 className="share-title">{snapshot.title}</h1>
        <p className="share-context">
          {snapshot.workout.date.replaceAll("-", ".")} · {snapshot.workout.name}{" "}
          · 训练快照
        </p>
        <WorkoutPresentation snapshot={snapshot} template={share.template} sheetToken={share.token} />
        <div className="share-toolbar">
          <span>这张页面记录了分享时的训练数据。</span>
          <span>有效至 {share.expiresAt.slice(0, 10)} · 分享者可随时撤销</span>
        </div>
      </main>
      <footer className="share-footer">
        <span>
          YOUR BODY. YOUR DATA. YOUR EXPRESSION.
          <br />
          独立项目，与 WHOOP 官方无隶属关系。
        </span>
        <Link href="/sign-in">登录 Whooper，记录你的训练 ↗</Link>
      </footer>
    </div>
  );
}
