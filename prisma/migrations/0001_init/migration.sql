-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "preferred_timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "whoop_user_id" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "access_ciphertext" TEXT NOT NULL,
    "refresh_ciphertext" TEXT NOT NULL,
    "token_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "token_version" INTEGER NOT NULL DEFAULT 1,
    "last_refresh_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whoop_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_records" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "native_id" TEXT NOT NULL,
    "v1_id" TEXT,
    "cycle_id" TEXT,
    "sleep_id" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "timezone_offset" INTEGER,
    "score_state" TEXT,
    "source_created_at" TIMESTAMPTZ(6),
    "source_updated_at" TIMESTAMPTZ(6),
    "payload_jsonb" JSONB NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whoop_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "start_at" TIMESTAMPTZ(6),
    "end_at" TIMESTAMPTZ(6),
    "next_token" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "pages_done" INTEGER NOT NULL DEFAULT 0,
    "items_upserted" INTEGER NOT NULL DEFAULT 0,
    "last_error_redacted" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "whoop_user_id" TEXT,
    "resource_id" TEXT,
    "event_type" TEXT NOT NULL,
    "payload_jsonb" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "last_error" TEXT,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_metrics" (
    "connection_id" TEXT NOT NULL,
    "local_date" DATE NOT NULL,
    "cycle_id" TEXT,
    "recovery_score" INTEGER,
    "hrv_rmssd_ms" DOUBLE PRECISION,
    "resting_hr_bpm" DOUBLE PRECISION,
    "sleep_hours" DOUBLE PRECISION,
    "sleep_performance_pct" DOUBLE PRECISION,
    "strain" DOUBLE PRECISION,
    "steps" INTEGER,
    "flags_jsonb" JSONB,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("connection_id","local_date")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT,
    "action" TEXT NOT NULL,
    "request_id" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_connections_user_id_whoop_user_id_key" ON "whoop_connections"("user_id", "whoop_user_id");

-- CreateIndex
CREATE INDEX "whoop_records_connection_id_kind_started_at_idx" ON "whoop_records"("connection_id", "kind", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_records_connection_id_kind_native_id_key" ON "whoop_records"("connection_id", "kind", "native_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_trace_id_key" ON "webhook_events"("trace_id");

-- AddForeignKey
ALTER TABLE "whoop_connections" ADD CONSTRAINT "whoop_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_records" ADD CONSTRAINT "whoop_records_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "whoop_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "whoop_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
