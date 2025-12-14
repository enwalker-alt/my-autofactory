-- CreateEnum
CREATE TYPE "WorkflowKind" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateTable
CREATE TABLE "WorkflowProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "WorkflowKind" NOT NULL DEFAULT 'PERSONAL',
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowProfile_userId_idx" ON "WorkflowProfile"("userId");

-- CreateIndex
CREATE INDEX "WorkflowProfile_userId_kind_idx" ON "WorkflowProfile"("userId", "kind");

-- AddForeignKey
ALTER TABLE "WorkflowProfile" ADD CONSTRAINT "WorkflowProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
