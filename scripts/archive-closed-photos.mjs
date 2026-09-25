import console from 'node:console';
import process from 'node:process';
import { PrismaClient } from '@prisma/client';
import { loadConfig } from '../server/config.js';
import { createLocalStorage } from '../server/local-storage.js';
import { createPhotoStorage } from '../server/photo-storage.js';

const config = loadConfig();
if (!config.photos.s3) throw new Error('PHOTO_STORAGE=s3 is required');
const prisma = new PrismaClient();
const storage = createPhotoStorage({ bucket: config.photos.bucket, region: config.photos.region, localStorage: createLocalStorage(config.uploadDirectory) });
try {
  const candidates = await prisma.upload.findMany({ where: { purpose: 'photo', status: 'READY', objectKey: { startsWith: 'active/' }, submission: { is: { ownerState: { in: ['CLOSED', 'SOLD', 'REMOVED'] } } } }, take: 100, select: { id: true, objectKey: true } });
  for (const photo of candidates) {
    const destination = await storage.archiveClosedAdPhoto(photo.objectKey);
    await prisma.upload.updateMany({ where: { id: photo.id, objectKey: photo.objectKey }, data: { objectKey: destination } });
  }
  console.log(`Archived ${candidates.length} closed photos`);
} catch (error) {
  console.error('Closed photo archive failed', error.name);
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
