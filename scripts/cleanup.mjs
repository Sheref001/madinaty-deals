/* global console, process */
import { PrismaClient } from '@prisma/client';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { loadConfig } from '../server/config.js';
const config = loadConfig();
const prisma = new PrismaClient();
const storage = new S3Client(config.storage);
try {
  const now = new Date();
  const cutoff = new Date(Date.now() - 86400000);
  await prisma.$transaction([
    prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.otpChallenge.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  const candidates = await prisma.upload.findMany({ where: { createdAt: { lt: cutoff }, submissionId: null, verificationId: null }, take: 100 });
  let removed = 0;
  for (const candidate of candidates) {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${candidate.userId}))`;
      const current = await tx.upload.findUnique({ where: { id: candidate.id } });
      if (!current || current.submissionId || current.verificationId) return;
      await storage.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: current.objectKey }));
      await tx.upload.delete({ where: { id: current.id } });
      removed++;
    }, { timeout: 30000 });
  }
  console.log(`Removed ${removed} expired unsubmitted uploads.`);
} catch (error) {
  console.error('Cleanup failed', error.code || error.name);
  process.exitCode = 1;
} finally { await prisma.$disconnect(); storage.destroy(); }
