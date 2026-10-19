import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const publicPaths = new Set([
  "/",
  "/privacy",
  "/api/webhooks/whoop",
  "/api/mcp",
  "/api/public/workout",
  "/api/public/workout/strength",
  "/api/jobs/reconcile",
  // One-time OAuth code handoff for the owner's AI assistant. The code is
  // useless without the PKCE verifier, so this page needs no sign-in.
  "/connect/muse",
]);

export default clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname;
  const isPublic =
    publicPaths.has(path) ||
    path === "/sign-in" ||
    path.startsWith("/sign-in/") ||
    path.startsWith("/share/") ||
    path.startsWith("/.well-known/");
  // These handlers authenticate at the resource and return a JSON 401. Clerk's
  // protect() intentionally masks unauthenticated API requests as a 404.
  const resourceAuthenticates =
    path === "/api/dashboard" ||
    path.startsWith("/api/dashboard/") ||
    path === "/api/shares" ||
    path.startsWith("/api/shares/");
  if (!isPublic && !resourceAuthenticates) {
    if (
      req.nextUrl.pathname.startsWith("/dashboard") &&
      !(await auth()).userId
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
