ALTER TABLE "Download" ADD COLUMN "anonymousClientId" TEXT;
CREATE INDEX "Download_anonymousClientId_createdAt_idx" ON "Download"("anonymousClientId", "createdAt");
