-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'canvas',
ALTER COLUMN "canvasCourseId" DROP NOT NULL;
