import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { profileSchema, genderLabel } from "../lib/profile/schema";
import { encryptArtwork, decryptArtwork } from "../lib/ledger/crypto";
import { sheetGroups } from "../lib/ledger/groups";
import { makeShareSnapshot, snapshotSchema } from "../lib/shares/policy";
import { DEMO_DASHBOARD, DEMO_STRENGTH } from "../lib/dashboard/demo";

test("profile preferences are explicit, bounded and do not accept client identity or health data", () => {
  assert.deepEqual(
    profileSchema.parse({ displayName: " 小李 ", gender: "female" }),
    { displayName: "小李", gender: "female" },
  );
  assert.equal(
    profileSchema.safeParse({ displayName: "a".repeat(33), gender: "male" })
      .success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({
      displayName: "Alex",
      gender: "male",
      userId: "someone-else",
    }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({ displayName: "Alex", gender: "inferred" })
      .success,
    false,
  );
  assert.equal(genderLabel("hidden"), "");
  assert.equal(genderLabel("female"), "F");
});

test("share identity is copied into the immutable snapshot; older snapshots remain valid", () => {
  const workout = DEMO_DASHBOARD.workouts.find(
    (w) => w.id === DEMO_STRENGTH.activity_id,
  )!;
  const profile = { displayName: "小李", gender: "female" as const };
  const snapshot = makeShareSnapshot(
    "Session",
    workout,
    DEMO_STRENGTH,
    profile,
  );
  profile.displayName = "New name";
  assert.equal(snapshot.profile?.displayName, "小李");
  assert.equal(
    snapshotSchema.safeParse(
      makeShareSnapshot("Old session", workout, DEMO_STRENGTH),
    ).success,
    true,
  );
});

test("ledger grouping preserves every set and distinguishes zero from unknown", () => {
  const groups = sheetGroups([
    {
      id: "pull-up",
      name: "Pull up",
      sets: [
        { reps: 8, weight: 0, units: "kg" },
        { reps: 8, weight: 0, units: "kg" },
        { reps: 8, weight: null, units: "kg" },
        { reps: 8, weight: 0, units: "lbs" },
      ],
    },
  ]);
  assert.equal(groups.length, 3);
  assert.deepEqual(
    groups.map((g) => g.count),
    [2, 1, 1],
  );
  assert.equal(groups[1].weight, null);
  assert.equal(groups[2].units, "lbs");
  const all = sheetGroups(DEMO_STRENGTH.exercises);
  assert.equal(
    all.reduce((sum, g) => sum + g.count, 0),
    DEMO_STRENGTH.set_count,
  );
});

test("artwork encryption authenticates bytes and uses a distinct domain from token ciphertext", () => {
  const previous = process.env.TOKEN_ENCRYPTION_KEY_BASE64;
  try {
    process.env.TOKEN_ENCRYPTION_KEY_BASE64 =
      randomBytes(32).toString("base64");
    const source = Buffer.from("private image bytes");
    const encrypted = encryptArtwork(source);
    assert.deepEqual(decryptArtwork(encrypted), source);
    assert.notDeepEqual(encryptArtwork(source), encrypted);
    encrypted[14] ^= 1;
    assert.throws(() => decryptArtwork(encrypted));
    assert.throws(() => decryptArtwork(Buffer.alloc(4)));
  } finally {
    if (previous === undefined) delete process.env.TOKEN_ENCRYPTION_KEY_BASE64;
    else process.env.TOKEN_ENCRYPTION_KEY_BASE64 = previous;
  }
});

test("the landing brand theme is accepted for share creation", async () => {
  const { shareInputSchema } = await import("../lib/shares/policy");
  assert.equal(
    shareInputSchema.parse({
      workoutId: "w1",
      template: "ledger",
      theme: "whooper",
      title: "My card",
    }).theme,
    "whooper",
  );
});
