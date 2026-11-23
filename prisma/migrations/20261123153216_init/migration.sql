-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "deadline" DATETIME,
    "submittedAt" DATETIME,
    "score" REAL
);

-- CreateTable
CREATE TABLE "SectionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME,
    "deadline" DATETIME,
    "submittedAt" DATETIME,
    "score" REAL,
    CONSTRAINT "SectionAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionAttemptId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "hostPath" TEXT NOT NULL,
    "containerHandle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Workspace_sectionAttemptId_fkey" FOREIGN KEY ("sectionAttemptId") REFERENCES "SectionAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "passed" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "exitCode" INTEGER,
    "timedOut" BOOLEAN NOT NULL DEFAULT false,
    "resultsJson" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionAttemptId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "testRunId" TEXT,
    "diff" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submission_sectionAttemptId_fkey" FOREIGN KEY ("sectionAttemptId") REFERENCES "SectionAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SectionAttempt_sessionId_sectionId_key" ON "SectionAttempt"("sessionId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_testRunId_key" ON "Submission"("testRunId");
