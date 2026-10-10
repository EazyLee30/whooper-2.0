import Link from 'next/link';
export default function Privacy() {
  return <main className="shell"><Link href="/">← whooper</Link><h1>隐私说明</h1><p>Whooper 是独立的 WHOOP 数据分析工具。授权后，服务读取你同意提供的基本资料、身体数据、恢复、睡眠、cycle 和训练记录。</p><p>WHOOP 授权令牌加密存储在服务端数据库；历史同步将原始健康记录保存到数据库，用于覆盖检查与缓存。账号登录由 Clerk 提供，服务托管于 Vercel，数据库由 Neon 提供。</p><p>使用插件查询时，所请求的数据会返回给你当前使用的 ChatGPT 或 Codex 对话。服务不会把令牌返回给插件，也不应将健康数据写入公共日志。</p><p>你可以在 WHOOP 的已连接应用设置中撤销 Whooper 授权。撤销授权会阻止后续 API 访问，但不会自动删除已经存储的历史记录。你可以在连接设置中永久删除自己的 Whooper 连接、令牌与缓存记录。该操作不会删除 WHOOP 原始数据或 Clerk 登录账号。请勿在公开 issue 中提交健康数据或密钥。</p><p><a href="https://github.com/EazyLee30">联系维护者</a></p><p>更新日期：2026-10-10</p></main>;
}
