import { profileSchema, type ShareProfile } from "@/lib/profile/schema";
import { z } from "zod";
import { isTemplateId, isThemeId } from "@/lib/presentation";
import type {
  ShareRecord,
  ShareSnapshot,
  WorkoutSummary,
} from "@/lib/dashboard/types";
import type { PublicStrength } from "@/lib/public-workout/strength-data";

const positiveNumber = z.number().finite().nonnegative();
const nullableNumber = positiveNumber.nullable();
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.iso.datetime({ offset: true });
const title = z.string().trim().min(1).max(80);
export const shareInputSchema = z
  .object({
    workoutId: identifier,
    template: z.custom<ShareRecord["template"]>(isTemplateId),
    theme: z.custom<string>(isThemeId),
    title,
  })
  .strict();

const workoutSchema = z.object({
  id: identifier,
  date,
  start: timestamp,
  end: timestamp,
  name: z.string().max(100),
  durationMin: positiveNumber,
  strain: z.number().min(0).max(21).nullable(),
  calories: nullableNumber,
});
const strengthSchema = z.object({
  fetched_at: timestamp,
  date,
  timezone: z.string().max(100),
  activity_id: identifier,
  duration_min: positiveNumber,
  strain: z.number().min(0).max(21).nullable(),
  total_volume_kg: nullableNumber,
  exercise_count: positiveNumber,
  set_count: positiveNumber,
  exercises: z
    .array(
      z.object({
        id: z.string().max(200),
        name: z.string().max(300),
        sets: z
          .array(
            z.object({
              reps: positiveNumber,
              weight: nullableNumber,
              units: z.enum(["kg", "lbs"]),
            }),
          )
          .max(200),
      }),
    )
    .max(200),
});
export const snapshotSchema = z
  .object({
    version: z.literal(1),
    profile: profileSchema.optional(),
    title,
    workout: workoutSchema,
    strength: strengthSchema.nullable(),
  })
  .refine(
    (value) =>
      !value.strength ||
      (value.strength.activity_id === value.workout.id &&
        value.strength.date === value.workout.date &&
        value.strength.duration_min === value.workout.durationMin &&
        value.strength.strain === value.workout.strain),
    { message: "Strength details must describe the shared workout" },
  );

// Parse constructs a new allowlisted object at every level. Private payload fields never enter storage or a public response.
export function makeShareSnapshot(
  title: string,
  workout: WorkoutSummary,
  strength: PublicStrength | null,
  profile?: ShareProfile,
): ShareSnapshot {
  return snapshotSchema.parse({
    version: 1,
    title,
    workout,
    strength,
    ...(profile ? { profile } : {}),
  });
}

export const SHARE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const validShareToken = (token: string) =>
  /^[a-zA-Z0-9_-]{43}$/.test(token);
export function shareIsActive(
  share: Pick<ShareRecord, "expiresAt" | "revokedAt">,
  now = new Date(),
) {
  return (
    share.revokedAt === null &&
    Number.isFinite(Date.parse(share.expiresAt)) &&
    Date.parse(share.expiresAt) > now.getTime()
  );
}
