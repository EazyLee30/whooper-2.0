export class DashboardError extends Error {
  constructor(message: string, public status = 400, public code = 'invalid_request') { super(message); }
}

export function schemaUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; meta?: { code?: string; driverAdapterError?: { cause?: { originalCode?: string } } }; cause?: unknown };
  return value.code === 'P2021' || value.code === 'P2022' || value.code === '42P01' || value.code === '42703' || value.meta?.code === '42P01' || value.meta?.code === '42703' || value.meta?.driverAdapterError?.cause?.originalCode === '42P01' || !!(value.cause && value.cause !== error && schemaUnavailable(value.cause));
}

export function privateJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
}

export function apiError(error: unknown) {
  if (error instanceof DashboardError) return privateJson({ error: error.message, code: error.code }, error.status);
  if (schemaUnavailable(error)) return privateJson({ error: 'The dashboard database update has not been applied yet.', code: 'schema_unavailable' }, 503);
  return privateJson({ error: 'Data is temporarily unavailable. Please try again.', code: 'service_unavailable' }, 503);
}

export function sameOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new DashboardError('Invalid origin', 403, 'invalid_origin');
}
