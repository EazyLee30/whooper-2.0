import { allowedOrigin, visitorValid } from '@/lib/public-workout/policy';
import { workoutStatus, nudge } from '@/lib/public-workout/service';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';
function headers(req: Request) {
  const origin = req.headers.get('origin');
  return { 'Cache-Control': 'no-store', Vary: 'Origin', ...(allowedOrigin(origin) ? { 'Access-Control-Allow-Origin': origin!, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } : {}) };
}
function json(req: Request, data: unknown, status = 200) { return Response.json(data, { status, headers: headers(req) }); }
export function OPTIONS(req: Request) { return new Response(null, { status: allowedOrigin(req.headers.get('origin')) ? 204 : 403, headers: headers(req) }); }
export async function GET(req: Request) {
  const visitor = new URL(req.url).searchParams.get('visitor');
  try { return json(req, await workoutStatus(visitorValid(visitor) ? visitor : undefined)); }
  catch { return json(req, { error: 'Workout status temporarily unavailable' }, 503); }
}
export async function POST(req: Request) {
  if (!allowedOrigin(req.headers.get('origin'))) return json(req, { error: 'Invalid origin' }, 403);
  if (!req.headers.get('content-type')?.startsWith('application/json') || Number(req.headers.get('content-length') || 0) > 256) return json(req, { error: 'Invalid request' }, 400);
  try {
    const text = await req.text();
    if (text.length > 256) return json(req, { error: 'Invalid request' }, 400);
    let input;
    try { input = JSON.parse(text); } catch { return json(req, { error: 'Invalid request' }, 400); }
    if (!input || typeof input !== 'object') return json(req, { error: 'Invalid request' }, 400);
    if (!visitorValid(input.visitor)) return json(req, { error: 'Invalid visitor' }, 400);
    const status = await workoutStatus(input.visitor);
    if (input.date !== status.date || status.status !== 'not_recorded') return json(req, status, 409);
    const network = req.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-forwarded-for')?.split(',')[0].trim();
    if (!network) return json(req, { error: 'Request identity unavailable' }, 503);
    const result = await nudge(input.visitor, network, status.date);
    if (result === 'limited') return json(req, { error: 'Try again tomorrow' }, 429);
    return json(req, await workoutStatus(input.visitor), result === 'changed' ? 409 : 200);
  } catch { return json(req, { error: 'Nudge temporarily unavailable' }, 503); }
}
