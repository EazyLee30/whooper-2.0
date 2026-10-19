import { auth } from "@clerk/nextjs/server";
import { getSharedWorkout } from "@/lib/shares/service";
import { ownedWorkout, strengthForOwnedWorkout } from "@/lib/dashboard/service";
import { readProfile } from "@/lib/profile/service";
import { makeShareSnapshot } from "@/lib/shares/policy";
import { renderLedgerCard } from "@/lib/ledger/render";
import { apiError, privateJson } from "@/lib/dashboard/errors";
import { DEMO_DASHBOARD, DEMO_STRENGTH } from "@/lib/dashboard/demo";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function GET(request: Request) {
  try {
    const url = new URL(request.url),
      token = url.searchParams.get("share"),
      workoutId = url.searchParams.get("workout");
    const pageText = url.searchParams.get("page") ?? "0";
    if (!/^\d{1,4}$/.test(pageText))
      return privateJson({ error: "Not found" }, 404);
    let snapshot;
    if (token) {
      const result = await getSharedWorkout(token);
      if (!result) return privateJson({ error: "Not found" }, 404);
      snapshot = result.snapshot;
    } else {
      const { userId } = await auth();
      if (!userId) return privateJson({ error: "Sign in first" }, 401);
      const profile = await readProfile(userId);
      if (workoutId?.startsWith("demo-")) {
        const workout = DEMO_DASHBOARD.workouts.find(
          (item) => item.id === DEMO_STRENGTH.activity_id,
        )!;
        snapshot = makeShareSnapshot("示例", workout, DEMO_STRENGTH, {
          displayName: "示例 · SAMPLE",
          gender: "hidden",
        });
      } else {
        const owner = await ownedWorkout(userId, workoutId ?? "");
        if (!owner.summary) return privateJson({ error: "Not found" }, 404);
        snapshot = makeShareSnapshot(
          "训练记录",
          owner.summary,
          await strengthForOwnedWorkout(owner),
          profile,
        );
      }
    }
    const image = await renderLedgerCard(snapshot, Number(pageText));
    if (!image) return privateJson({ error: "Not found" }, 404);
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, noarchive",
        "Content-Disposition": 'inline; filename="whooper-training-card.png"',
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
