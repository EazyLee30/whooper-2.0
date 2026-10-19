import { clerkClient } from "@clerk/nextjs/server";
import { profileSchema, emptyProfile } from "./schema";
export async function readProfile(userId: string) {
  const user = await (await clerkClient()).users.getUser(userId);
  const result = profileSchema.safeParse(user.privateMetadata.whooperProfile);
  return result.success ? result.data : emptyProfile;
}
