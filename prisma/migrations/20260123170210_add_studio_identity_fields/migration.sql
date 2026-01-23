-- AlterTable
ALTER TABLE "Studio" ADD COLUMN     "beliefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mandates" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "pillars" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "pov" TEXT;
