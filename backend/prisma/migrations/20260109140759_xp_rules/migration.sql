-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completionXpAwarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "difficulty" TEXT NOT NULL DEFAULT 'medium';

-- AlterTable
ALTER TABLE "UserStats" ADD COLUMN     "dailyBaseXp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dailyDate" TIMESTAMP(3),
ADD COLUMN     "dailyXp" INTEGER NOT NULL DEFAULT 0;
