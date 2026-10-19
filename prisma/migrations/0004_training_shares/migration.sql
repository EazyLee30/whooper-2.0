CREATE TABLE "training_shares" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "token" TEXT NOT NULL,
  "template" TEXT NOT NULL CHECK ("template" IN ('ledger','illustrated','journal','pulse')),
  "theme" TEXT NOT NULL CHECK ("theme" IN ('flexoki','monochrome','latte','tokyo','gruvbox','nord','rose','matrix')),
  "title" TEXT NOT NULL CHECK (char_length("title") BETWEEN 1 AND 80),
  "snapshot_jsonb" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  CONSTRAINT "training_shares_lifetime" CHECK ("expires_at" > "created_at" AND "expires_at" <= "created_at" + INTERVAL '720 hours')
);
CREATE UNIQUE INDEX "training_shares_token_key" ON "training_shares"("token");
CREATE INDEX "training_shares_user_id_created_at_idx" ON "training_shares"("user_id","created_at");
