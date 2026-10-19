import Link from "next/link";
import "@/components/dashboard.css";

export default function ShareNotFound() {
  return (
    <main className="dashboard share-page" lang="zh-CN">
      <div className="share-unavailable">
        <span className="dash-overline">WHOOPER / SHARED TRAINING</span>
        <h1>这一页，已收起。</h1>
        <p>分享链接不存在、已撤销，或已过期。请联系分享者获取新的链接。</p>
        <Link className="dash-button" href="/">
          回到 Whooper ↗
        </Link>
      </div>
    </main>
  );
}
