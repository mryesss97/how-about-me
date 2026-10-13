-- CreateTable
CREATE TABLE "analysis_settings" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "policy_version" TEXT NOT NULL,
    "confidence_bands" JSONB NOT NULL,
    "safety_thresholds" JSONB NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analysis_settings_project_id_version_key" ON "analysis_settings"("project_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_settings_project_id_policy_version_key" ON "analysis_settings"("project_id", "policy_version");

-- AddForeignKey
ALTER TABLE "analysis_settings" ADD CONSTRAINT "analysis_settings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "monitoring_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_settings" ADD CONSTRAINT "analysis_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
