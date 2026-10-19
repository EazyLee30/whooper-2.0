"use client";

import Link from "next/link";
import "@/components/dashboard.css";

export default function ShareError({ reset }: { reset: () => void }) {
  return (
    <main className="dashboard share-page" lang="zh-CN">
      <div className="share-unavailable">
        <span className="dash-overline">WHOOPER / SHARED TRAINING</span>
        <h1>暂时打不开这一页。</h1>
        <p>训练分享服务暂时不可用，请稍后重试。</p>
        <button className="dash-button" onClick={reset}>
          重新读取 ↻
        </button>
        <p>
          <Link href="/">回到 Whooper ↗</Link>
        </p>
      </div>
    </main>
  );
}
