'use client';
import { useState } from 'react';
type Job = { id: string; kind: string; status: string; itemsUpserted: number; lastErrorRedacted?: string | null };
export function SyncControls() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('查询工具直接读取 WHOOP 最新数据；历史同步用于数据覆盖与缓存。');
  async function sync() {
    setBusy(true);
    setMessage('正在同步，每页都会保存进度。');
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      if (!response.ok) throw new Error('同步失败，请确认连接状态后重试。');
      const status = await fetch('/api/sync');
      if (!status.ok) throw new Error('无法读取同步状态。');
      const data = await status.json() as { jobs: Job[] };
      setJobs(data.jobs);
      setMessage(data.jobs.some(j => ['queued', 'running'].includes(j.status)) ? '进度已保存，可继续同步；定时任务也会继续处理。' : '本轮同步结束。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '同步失败'); }
    finally { setBusy(false); }
  }
  return <section className="card"><h2>历史数据同步</h2><p role="status">{message}</p><button onClick={sync} disabled={busy}>{busy ? '同步中…' : '同步 / 继续历史数据'}</button>{jobs.length > 0 && <ul>{jobs.map(j => <li key={j.id}>{j.kind}：{j.status}，已保存 {j.itemsUpserted} 条{j.lastErrorRedacted ? '，可重试' : ''}</li>)}</ul>}</section>;
}
