-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('UNDER_CONSIDERATION', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "evaluationStatus" "EvaluationStatus" NOT NULL DEFAULT 'UNDER_CONSIDERATION',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;
