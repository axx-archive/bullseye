-- CreateTable
CREATE TABLE "FocusGroupMemoryItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "sentiment" "Sentiment",
    "referencedConcern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusGroupMemoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FocusGroupMemoryItem_projectId_readerId_idx" ON "FocusGroupMemoryItem"("projectId", "readerId");

-- CreateIndex
CREATE INDEX "FocusGroupMemoryItem_draftId_readerId_idx" ON "FocusGroupMemoryItem"("draftId", "readerId");

-- CreateIndex
CREATE INDEX "FocusGroupMemoryItem_projectId_draftId_idx" ON "FocusGroupMemoryItem"("projectId", "draftId");
