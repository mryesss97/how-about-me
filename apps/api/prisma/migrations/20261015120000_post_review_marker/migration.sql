-- T-144 / BR-040: review queue marker on social_posts (no FK, joined to user_profiles on read).
ALTER TABLE "social_posts" ADD COLUMN "reviewed_at" TIMESTAMPTZ(6),
ADD COLUMN "reviewed_by" UUID;
