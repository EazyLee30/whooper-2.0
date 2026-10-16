CREATE TABLE "strength_sessions" (
  "connection_id" TEXT PRIMARY KEY REFERENCES "whoop_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "access_ciphertext" TEXT NOT NULL,
  "refresh_ciphertext" TEXT NOT NULL,
  "token_expires_at" TIMESTAMPTZ(6) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "updated_at" TIMESTAMPTZ(6) NOT NULL
);
