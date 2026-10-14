-- #223 / FR-120 / BR-041: key phrases per analysis (append-only, written with post_analyses).
-- CreateTable
CREATE TABLE "analysis_phrases" (
    "analysis_id" UUID NOT NULL,
    "phrase" TEXT NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "analysis_phrases_pkey" PRIMARY KEY ("analysis_id","phrase"),
    -- BR-041: normalised phrase length, ≤ 5 per analysis, never contains the CSV filter separator.
    CONSTRAINT "analysis_phrases_phrase_length_chk" CHECK (char_length("phrase") BETWEEN 1 AND 60),
    CONSTRAINT "analysis_phrases_phrase_no_comma_chk" CHECK (position(',' in "phrase") = 0),
    CONSTRAINT "analysis_phrases_position_chk" CHECK ("position" BETWEEN 0 AND 4)
);

-- CreateIndex
CREATE INDEX "analysis_phrases_phrase_analysis_id_idx" ON "analysis_phrases"("phrase", "analysis_id");

-- AddForeignKey
ALTER TABLE "analysis_phrases" ADD CONSTRAINT "analysis_phrases_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "post_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
