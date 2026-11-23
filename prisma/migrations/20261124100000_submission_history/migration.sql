-- Keep every graded attempt (retries no longer delete submissions) and copy the stats it needs.
ALTER TABLE "Submission" ADD COLUMN "passed" INTEGER;
ALTER TABLE "Submission" ADD COLUMN "total" INTEGER;
ALTER TABLE "Submission" ADD COLUMN "timeSpentMs" INTEGER;
ALTER TABLE "Submission" ADD COLUMN "testRuns" INTEGER;
ALTER TABLE "Submission" ADD COLUMN "supersededAt" DATETIME;

UPDATE "Submission" SET
  "passed" = (SELECT "passed" FROM "TestRun" WHERE "TestRun"."id" = "Submission"."testRunId"),
  "total"  = (SELECT "total"  FROM "TestRun" WHERE "TestRun"."id" = "Submission"."testRunId")
WHERE "testRunId" IS NOT NULL;

UPDATE "Submission" SET "testRuns" = (
  SELECT COUNT(*) FROM "TestRun" JOIN "Workspace" ON "TestRun"."workspaceId" = "Workspace"."id"
  WHERE "Workspace"."sectionAttemptId" = "Submission"."sectionAttemptId" AND "Workspace"."challengeId" = "Submission"."challengeId"
);
