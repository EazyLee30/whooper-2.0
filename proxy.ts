import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/privacy',
  '/sign-in(.*)',
  '/api/webhooks/whoop',
  '/.well-known/(.*)',
  '/api/mcp',
  '/api/public/workout',
  '/api/public/workout/strength',
  '/api/jobs/reconcile',
  // One-time OAuth code handoff for the owner's AI assistant. The code is
  // useless without the PKCE verifier, so this page needs no sign-in.
  '/connect/muse',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
