import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/privacy',
  '/sign-in(.*)',
  '/api/webhooks/whoop',
  '/.well-known/(.*)',
  '/api/mcp',
  '/api/public/workout',
  '/api/jobs/reconcile',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
