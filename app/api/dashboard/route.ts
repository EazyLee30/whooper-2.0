import { auth } from '@clerk/nextjs/server';
import { getDashboard } from '@/lib/dashboard/service';
import { apiError, privateJson } from '@/lib/dashboard/errors';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return privateJson({ error: 'Sign in first', code: 'unauthorized' }, 401);
    const date = new URL(request.url).searchParams.get('date') ?? undefined;
    return privateJson(await getDashboard(userId, date));
  } catch (error) { return apiError(error); }
}
