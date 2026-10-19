import { auth } from '@clerk/nextjs/server';
import { revokeShare } from '@/lib/shares/service';
import { apiError, privateJson, sameOrigin } from '@/lib/dashboard/errors';

export const dynamic = 'force-dynamic';
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return privateJson({ error: 'Sign in first', code: 'unauthorized' }, 401);
    sameOrigin(request);
    const { id } = await context.params;
    await revokeShare(userId, id);
    return privateJson({ revoked: true });
  } catch (error) { return apiError(error); }
}
