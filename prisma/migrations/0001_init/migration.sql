-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ProjectFormat" AS ENUM ('FEATURE', 'TV_PILOT', 'TV_EPISODE', 'SHORT', 'LIMITED_SERIES', 'DOCUMENTARY');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'ANALYZING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FocusSessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SpeakerType" AS ENUM ('MODERATOR', 'READER', 'USER');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "ExecutiveVerdict" AS ENUM ('PURSUE', 'PASS');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('SCOUT', 'READER', 'EXECUTIVE', 'MODERATOR');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('COVERAGE_FULL', 'INTAKE_FULL', 'FOCUS_GROUP_TRANSCRIPT', 'CHAT_TRANSCRIPT', 'SCRIPT_TEXT');

-- CreateTable
CREATE TABLE "Studio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "supabaseAuthId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "studioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "logline" TEXT,
    "genre" TEXT NOT NULL,
    "format" "ProjectFormat" NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "studioId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "draftNumber" INTEGER NOT NULL,
    "scriptUrl" TEXT NOT NULL,
    "scriptText" TEXT,
    "pageCount" INTEGER,
    "notes" TEXT,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftDeliverable" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "harmonizedCoverage" JSONB NOT NULL,
    "harmonizedIntake" JSONB NOT NULL,
    "harmonizedScores" JSONB NOT NULL,
    "readerPerspectives" JSONB NOT NULL,
    "scoutAnalysis" JSONB NOT NULL,
    "studioCalibration" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaderPersona" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatar" TEXT,
    "background" TEXT NOT NULL,
    "favoriteFilms" TEXT[],
    "voiceDescription" TEXT NOT NULL,
    "analyticalFocus" TEXT[],
    "premiseWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "characterWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "dialogueWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "structureWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "commercialityWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "systemPromptBase" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderPersona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaderMemory" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "narrativeSummary" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "keyStrengths" TEXT[],
    "keyConcerns" TEXT[],
    "standoutQuote" TEXT,
    "evidenceStrength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "focusGroupItems" JSONB NOT NULL DEFAULT '[]',
    "chatHighlights" JSONB NOT NULL DEFAULT '[]',
    "scoreDeltas" JSONB,
    "evolutionNotes" TEXT,
    "coverageResourceId" TEXT,
    "focusGroupResourceId" TEXT,
    "chatResourceId" TEXT,
    "priorMemoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryItem" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "importance" TEXT NOT NULL,
    "pageReference" TEXT,
    "sentiment" "Sentiment",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusSession" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "topic" TEXT,
    "status" "FocusSessionStatus" NOT NULL DEFAULT 'PENDING',
    "moderatorPrompt" TEXT,
    "questions" TEXT[],
    "summary" TEXT,
    "consensusPoints" TEXT[],
    "divergencePoints" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusGroupMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "speakerType" "SpeakerType" NOT NULL,
    "readerId" TEXT,
    "content" TEXT NOT NULL,
    "topic" TEXT,
    "sentiment" "Sentiment",
    "sequenceNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusGroupMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutiveProfile" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "avatar" TEXT,
    "filmography" TEXT[],
    "trackRecordSummary" TEXT NOT NULL,
    "recentTradeContext" TEXT[],
    "tradeContextUpdatedAt" TIMESTAMP(3),
    "evaluationStyle" TEXT NOT NULL,
    "priorityFactors" TEXT[],
    "dealBreakers" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutiveProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutiveEvaluation" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "executiveId" TEXT NOT NULL,
    "verdict" "ExecutiveVerdict" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "keyFactors" TEXT[],
    "concerns" TEXT[],
    "groundedInCoverage" BOOLEAN NOT NULL DEFAULT true,
    "citedElements" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutiveEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioIntelligence" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "projectSummaries" JSONB NOT NULL DEFAULT '[]',
    "totalProjectsAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "scoreDistributions" JSONB NOT NULL DEFAULT '{}',
    "recommendationBreakdown" JSONB NOT NULL DEFAULT '{}',
    "averagesByGenre" JSONB NOT NULL DEFAULT '{}',
    "topPerformerIds" TEXT[],
    "recentTrends" JSONB,
    "institutionalNarrative" TEXT,
    "genreNarratives" JSONB NOT NULL DEFAULT '{}',
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "agentType" "AgentType",
    "readerId" TEXT,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceArchive" (
    "id" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "projectId" TEXT,
    "draftId" TEXT,
    "sessionId" TEXT,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "metadata" JSONB,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Studio_ownerId_slug_key" ON "Studio"("ownerId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseAuthId_key" ON "User"("supabaseAuthId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Draft_projectId_draftNumber_key" ON "Draft"("projectId", "draftNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DraftDeliverable_draftId_key" ON "DraftDeliverable"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderMemory_priorMemoryId_key" ON "ReaderMemory"("priorMemoryId");

-- CreateIndex
CREATE INDEX "ReaderMemory_projectId_readerId_idx" ON "ReaderMemory"("projectId", "readerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderMemory_draftId_readerId_key" ON "ReaderMemory"("draftId", "readerId");

-- CreateIndex
CREATE INDEX "MemoryItem_memoryId_topic_idx" ON "MemoryItem"("memoryId", "topic");

-- CreateIndex
CREATE INDEX "MemoryItem_memoryId_importance_idx" ON "MemoryItem"("memoryId", "importance");

-- CreateIndex
CREATE INDEX "FocusGroupMessage_sessionId_sequenceNumber_idx" ON "FocusGroupMessage"("sessionId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutiveEvaluation_draftId_executiveId_key" ON "ExecutiveEvaluation"("draftId", "executiveId");

-- CreateIndex
CREATE UNIQUE INDEX "StudioIntelligence_studioId_key" ON "StudioIntelligence"("studioId");

-- CreateIndex
CREATE INDEX "ChatMessage_projectId_createdAt_idx" ON "ChatMessage"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ResourceArchive_resourceType_draftId_idx" ON "ResourceArchive"("resourceType", "draftId");

-- CreateIndex
CREATE INDEX "ResourceArchive_contentHash_idx" ON "ResourceArchive"("contentHash");

-- AddForeignKey
ALTER TABLE "Studio" ADD CONSTRAINT "Studio_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftDeliverable" ADD CONSTRAINT "DraftDeliverable_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderPersona" ADD CONSTRAINT "ReaderPersona_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderMemory" ADD CONSTRAINT "ReaderMemory_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderMemory" ADD CONSTRAINT "ReaderMemory_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "ReaderPersona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderMemory" ADD CONSTRAINT "ReaderMemory_priorMemoryId_fkey" FOREIGN KEY ("priorMemoryId") REFERENCES "ReaderMemory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "ReaderMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusSession" ADD CONSTRAINT "FocusSession_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusGroupMessage" ADD CONSTRAINT "FocusGroupMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FocusSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusGroupMessage" ADD CONSTRAINT "FocusGroupMessage_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "ReaderPersona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutiveProfile" ADD CONSTRAINT "ExecutiveProfile_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutiveEvaluation" ADD CONSTRAINT "ExecutiveEvaluation_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutiveEvaluation" ADD CONSTRAINT "ExecutiveEvaluation_executiveId_fkey" FOREIGN KEY ("executiveId") REFERENCES "ExecutiveProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioIntelligence" ADD CONSTRAINT "StudioIntelligence_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "ReaderPersona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
