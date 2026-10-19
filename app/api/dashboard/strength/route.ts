import { auth } from '@clerk/nextjs/server';
import { getDashboardStrength, validWorkoutId } from '@/lib/dashboard/service';
import { apiError, privateJson } from '@/lib/dashboard/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return privateJson({ error: 'Sign in first', code: 'unauthorized' }, 401);
    const workout = new URL(request.url).searchParams.get('workout');
    if (!validWorkoutId(workout)) return privateJson({ error: 'Choose a valid workout', code: 'invalid_request' }, 400);
    return privateJson({ session: await getDashboardStrength(userId, workout) });
  } catch (error) { return apiError(error); }
}
