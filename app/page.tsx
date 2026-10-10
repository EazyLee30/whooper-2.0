import Link from 'next/link';
export default function Home() {
  return <main className="shell"><header><span>whooper</span><Link href="/settings/connections">账号连接</Link></header>
    <p className="eyebrow">你的 WHOOP 数据教练</p><h1>读懂恢复，<br />安排好今天。</h1><p>用真实的恢复、睡眠、日负荷和训练数据，获得贴合个人状态的分析与建议。</p>
    <Link className="button" href="/settings/connections">连接 WHOOP</Link>
    <section className="card"><h2>在对话里使用</h2><p>Whooper 插件保留原 GPT 的资料、身体数据、恢复、睡眠、cycle 与训练查询，并支持历史分页和单条详情。</p><p>试试：“分析我最近七天的恢复和睡眠”，或“今天适合怎样训练？”</p></section>
    <p><Link href="/privacy">隐私说明</Link> · 独立应用，与 WHOOP 官方无隶属关系。</p>
  </main>;
}
