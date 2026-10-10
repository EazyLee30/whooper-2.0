import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { AccountControls } from './account-controls';
import { SyncControls } from './sync-controls';
export const dynamic = 'force-dynamic';
export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ bound?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const params = await searchParams;
  const account = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { preferredTimezone: true } });
  const conn = await prisma.whoopConnection.findFirst({ where: { user: { clerkUserId: userId } }, orderBy: { updatedAt: 'desc' }, select: { status: true } });
  return <main className="shell"><header><Link href="/">whooper</Link><UserButton /></header><h1>连接你的 WHOOP</h1><p>把恢复、睡眠和训练数据带入 ChatGPT 与 Codex。</p>
    {params.bound === '1' && <p role="status">WHOOP 已连接，历史同步已启动。</p>}
    <section className="card"><h2>WHOOP 账号</h2><p>状态：{conn?.status === 'active' ? '已连接' : conn ? '需要重新授权' : '尚未连接'}</p><a className="button" href="/api/auth/whoop/start">{conn ? '重新连接 WHOOP' : '连接 WHOOP'}</a></section>
    {conn?.status === 'active' && <SyncControls />}
    <AccountControls timezone={account?.preferredTimezone ?? 'Asia/Shanghai'} />
    <p><a href="/privacy">隐私说明</a></p>
  </main>;
}
