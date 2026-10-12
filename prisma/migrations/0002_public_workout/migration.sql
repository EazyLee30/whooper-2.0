-- CreateTable
CREATE TABLE "public_workout_profiles" (
    "slug" TEXT NOT NULL,
    "whoop_user_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "public_workout_profiles_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "public_workout_days" (
    "profile_slug" TEXT NOT NULL,
    "local_date" DATE NOT NULL,
    "trained" BOOLEAN,
    "checked_at" TIMESTAMPTZ(6),
    "refresh_after" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_until" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_workout_days_pkey" PRIMARY KEY ("profile_slug","local_date")
);

-- CreateTable
CREATE TABLE "public_workout_nudges" (
    "profile_slug" TEXT NOT NULL,
    "local_date" DATE NOT NULL,
    "visitor_hash" TEXT NOT NULL,
    "network_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_workout_nudges_pkey" PRIMARY KEY ("profile_slug","local_date","visitor_hash")
);

-- CreateIndex
CREATE INDEX "public_workout_nudges_network" ON "public_workout_nudges"("profile_slug", "local_date", "network_hash");

-- AddForeignKey
ALTER TABLE "public_workout_days" ADD CONSTRAINT "public_workout_days_profile_slug_fkey" FOREIGN KEY ("profile_slug") REFERENCES "public_workout_profiles"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_workout_nudges" ADD CONSTRAINT "public_workout_nudges_profile_slug_fkey" FOREIGN KEY ("profile_slug") REFERENCES "public_workout_profiles"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

