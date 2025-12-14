/*
  Warnings:

  - You are about to drop the `WorkflowProfile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WorkflowProfile" DROP CONSTRAINT "WorkflowProfile_userId_fkey";

-- DropTable
DROP TABLE "WorkflowProfile";

-- DropEnum
DROP TYPE "WorkflowKind";

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "ToolRating_userId_idx" ON "ToolRating"("userId");
