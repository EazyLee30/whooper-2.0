import { auth } from '@clerk/nextjs/server';
import { createShare, listShares } from '@/lib/shares/service';
import { apiError, DashboardError, privateJson, sameOrigin } from '@/lib/dashboard/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return privateJson({ error: 'Sign in first', code: 'unauthorized' }, 401);
    return privateJson({ shares: await listShares(userId) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return privateJson({ error: 'Sign in first', code: 'unauthorized' }, 401);
    sameOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json') || Number(request.headers.get('content-length') ?? 0) > 2048) throw new DashboardError('Invalid request');
    const body = await request.text();
    if (body.length > 2048) throw new DashboardError('Invalid request');
    let input: unknown;
    try { input = JSON.parse(body); } catch { throw new DashboardError('Invalid JSON'); }
    const share = await createShare(userId, input);
    const url = new URL(`/share/${share.token}`, process.env.NEXT_PUBLIC_APP_URL ?? request.url).toString();
    return privateJson({ share, url }, 201);
  } catch (error) { return apiError(error); }
}
