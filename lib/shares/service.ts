import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { ownedWorkout, strengthForOwnedWorkout } from "@/lib/dashboard/service";
import { DashboardError } from "@/lib/dashboard/errors";
import type { ShareRecord, ShareSnapshot } from "@/lib/dashboard/types";
import {
  makeShareSnapshot,
  shareInputSchema,
  shareIsActive,
  snapshotSchema,
  SHARE_LIFETIME_MS,
  validShareToken,
} from "./policy";

type ShareRow = Omit<ShareRecord, "createdAt" | "expiresAt" | "revokedAt"> & {
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};
const serialize = (row: ShareRow): ShareRecord => ({
  id: row.id,
  token: row.token,
  template: row.template,
  theme: row.theme,
  title: row.title,
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
  revokedAt: row.revokedAt?.toISOString() ?? null,
});

export function shareService(
  database = prisma,
  workouts = { ownedWorkout, strengthForOwnedWorkout },
  now = () => new Date(),
) {
  async function listShares(clerkUserId: string): Promise<ShareRecord[]> {
    const rows = await database.$queryRaw<
      ShareRow[]
    >`SELECT s.id,s.token,s.template,s.theme,s.title,s.created_at AS "createdAt",s.expires_at AS "expiresAt",s.revoked_at AS "revokedAt"
      FROM training_shares s JOIN users u ON u.id=s.user_id WHERE u.clerk_user_id=${clerkUserId} ORDER BY s.created_at DESC LIMIT 100`;
    return rows.map(serialize);
  }

  async function createShare(
    clerkUserId: string,
    input: unknown,
    profile?: import("@/lib/profile/schema").ShareProfile,
  ): Promise<ShareRecord> {
    const parsed = shareInputSchema.safeParse(input);
    if (!parsed.success)
      throw new DashboardError(
        "Choose a valid workout, template, theme and title (1–80 characters).",
      );
    const settings = parsed.data;
    const owner = await workouts.ownedWorkout(clerkUserId, settings.workoutId);
    const strength = await workouts.strengthForOwnedWorkout(owner);
    const snapshot = makeShareSnapshot(
      settings.title,
      owner.summary,
      strength,
      profile,
    );
    const createdAt = now();
    const expiresAt = new Date(createdAt.getTime() + SHARE_LIFETIME_MS);
    const share: ShareRow = {
      id: randomUUID(),
      token: randomBytes(32).toString("base64url"),
      template: settings.template,
      theme: settings.theme,
      title: settings.title,
      createdAt,
      expiresAt,
      revokedAt: null,
    };
    await database.$executeRaw`INSERT INTO training_shares(id,user_id,token,template,theme,title,snapshot_jsonb,created_at,expires_at)
      VALUES (${share.id},${owner.user!.id},${share.token},${share.template},${share.theme},${share.title},${JSON.stringify(snapshot)}::jsonb,${createdAt},${expiresAt})`;
    return serialize(share);
  }

  async function revokeShare(clerkUserId: string, id: string) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
      throw new DashboardError("Share not found", 404, "not_found");
    const updated =
      await database.$executeRaw`UPDATE training_shares SET revoked_at=coalesce(revoked_at,now()) WHERE id=${id} AND user_id IN (SELECT id FROM users WHERE clerk_user_id=${clerkUserId})`;
    if (!updated) throw new DashboardError("Share not found", 404, "not_found");
  }

  /** Public read-only snapshot. Never reaches a live WHOOP connection or private dashboard metrics. */
  async function getSharedWorkout(
    token: string,
  ): Promise<{ share: ShareRecord; snapshot: ShareSnapshot } | null> {
    if (!validShareToken(token)) return null;
    const rows = await database.$queryRaw<
      (ShareRow & { snapshot: unknown })[]
    >`SELECT id,token,template,theme,title,created_at AS "createdAt",expires_at AS "expiresAt",revoked_at AS "revokedAt",snapshot_jsonb AS snapshot
      FROM training_shares WHERE token=${token} AND revoked_at IS NULL AND expires_at>now() LIMIT 1`;
    const row = rows[0];
    if (!row) return null;
    const { snapshot: raw, ...metadata } = row;
    const share = serialize(metadata);
    if (!shareIsActive(share, now())) return null;
    const snapshot = snapshotSchema.safeParse(raw);
    if (!snapshot.success) return null;
    return { share, snapshot: snapshot.data };
  }

  return { listShares, createShare, revokeShare, getSharedWorkout };
}

export const { listShares, createShare, revokeShare, getSharedWorkout } =
  shareService();
