-- CreateTable
CREATE TABLE "ReaderAnalysisState" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "scores" JSONB,
    "recommendation" TEXT,
    "keyStrengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keyConcerns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "standoutQuote" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderAnalysisState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReaderAnalysisState_draftId_readerId_key" ON "ReaderAnalysisState"("draftId", "readerId");

-- AddForeignKey
ALTER TABLE "ReaderAnalysisState" ADD CONSTRAINT "ReaderAnalysisState_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
