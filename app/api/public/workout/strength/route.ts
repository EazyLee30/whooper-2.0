import { DateTime } from 'luxon';
import { publicStrength } from '@/lib/public-workout/strength';
import { allowedOrigin } from '@/lib/public-workout/policy';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const url = new URL(req.url); const date = url.searchParams.get('date') || undefined;
  const workout = url.searchParams.get('workout') || undefined;
  const origin = req.headers.get('origin');
  const localPreview = !!origin && /^http:\/\/(localhost|127\.0\.0\.1):8765$/.test(origin);
  const headers = { 'Cache-Control': 'no-store', Vary: 'Origin', ...(allowedOrigin(origin) || localPreview ? { 'Access-Control-Allow-Origin': origin! } : {}) };
  const json = (data: unknown, status=200) => Response.json(data, {status,headers});
  const day = date ? DateTime.fromISO(date, {zone:'Asia/Shanghai'}) : null;
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !day?.isValid || day.toISODate() !== date || day > DateTime.now().setZone('Asia/Shanghai').endOf('day'))) return json({error:'Invalid date'},400);
  if (workout && (!date || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(workout))) return json({error:'Invalid workout'},400);
  try {
    const session = await publicStrength(date,workout);
    return json({session},session ? 200 : 404);
  } catch { return json({error:'Strength data temporarily unavailable'},503); }
}
