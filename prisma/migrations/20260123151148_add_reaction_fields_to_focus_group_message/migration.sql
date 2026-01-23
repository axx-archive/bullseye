-- CreateEnum
CREATE TYPE "ReactionSentiment" AS ENUM ('AGREES', 'DISAGREES', 'BUILDS_ON');

-- AlterTable
ALTER TABLE "FocusGroupMessage" ADD COLUMN     "reactionSentiment" "ReactionSentiment",
ADD COLUMN     "replyToReaderId" TEXT;
