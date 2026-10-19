import { auth, clerkClient } from "@clerk/nextjs/server";
import { readProfile } from "@/lib/profile/service";
import { profileSchema } from "@/lib/profile/schema";
import {
  privateJson,
  sameOrigin,
  apiError,
  DashboardError,
} from "@/lib/dashboard/errors";
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return privateJson({ error: "Sign in first" }, 401);
    return privateJson({ profile: await readProfile(userId) });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return privateJson({ error: "Sign in first" }, 401);
    sameOrigin(request);
    const text = await request.text();
    if (text.length > 1024) throw new DashboardError("Invalid profile");
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      throw new DashboardError("Invalid JSON");
    }
    const result = profileSchema.safeParse(input);
    if (!result.success) throw new DashboardError("Invalid profile");
    await (
      await clerkClient()
    ).users.updateUserMetadata(userId, {
      privateMetadata: { whooperProfile: result.data },
    });
    return privateJson({ profile: result.data });
  } catch (error) {
    return apiError(error);
  }
}
