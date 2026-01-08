/*
  Warnings:

  - Added the required column `updatedAt` to the `IntegrationCanvas` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FixedEvent" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "IntegrationCanvas" ADD COLUMN     "lastImportedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "tokenEncrypted" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "WeeklyClass" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';
