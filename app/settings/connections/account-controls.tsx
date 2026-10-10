'use client';
import { useState } from 'react';
export function AccountControls({ timezone }: { timezone: string }) {
  const [zone, setZone] = useState(timezone);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const res = await fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timezone: zone }) });
      setMessage(res.ok ? '时区已保存。' : '保存失败，请使用有效的 IANA 时区。');
    } catch { setMessage('网络错误，请重试。'); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('永久删除此 Whooper 账号的连接、加密令牌和缓存健康记录？WHOOP 原始数据和 Clerk 登录账号不会删除。')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (res.ok) window.location.reload(); else setMessage('删除失败，请重试。');
    } catch { setMessage('网络错误，请重试。'); } finally { setBusy(false); }
  }
  return <section className="card"><h2>账号与数据</h2><label htmlFor="timezone">每日快照时区</label><input id="timezone" value={zone} onChange={e => setZone(e.target.value)} placeholder="Asia/Shanghai" /><button onClick={save} disabled={busy}>保存时区</button><p>可填写 Asia/Taipei、America/New_York 等 IANA 时区。</p><button onClick={remove} disabled={busy}>删除 Whooper 连接与缓存数据</button><p>删除后插件将无法读取数据；可在 WHOOP 的已连接应用中撤销授权。</p><p role="status">{message}</p></section>;
}
