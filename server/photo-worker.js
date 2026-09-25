import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import sharp from 'sharp';

const formats = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'heif', 'image/gif': 'gif' };
const client = new S3Client({ region: process.env.S3_PHOTO_REGION || process.env.AWS_REGION });

export async function processPhoto({ bucket, key, s3 = client }) {
  if (!/^raw\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid raw photo key');
  const destination = key.replace(/^raw\//, 'active/');
  let raw;
  try { raw = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })); }
  catch (error) {
    if (error.name !== 'NoSuchKey' && error.$metadata?.httpStatusCode !== 404) throw error;
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: destination }));
    return destination;
  }
  if (!formats[raw.ContentType] || !raw.ContentLength || raw.ContentLength > 5 * 1024 * 1024) throw new Error('Invalid photo size or type');
  const bytes = Buffer.from(await raw.Body.transformToByteArray());
  if (bytes.length !== raw.ContentLength || bytes.length > 5 * 1024 * 1024) throw new Error('Invalid photo size');
  const image = sharp(bytes, { limitInputPixels: 40000000, failOn: 'warning' });
  const metadata = await image.metadata();
  if (metadata.format !== formats[raw.ContentType]) throw new Error('Photo MIME mismatch');
  const output = await image.rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  if (output.length > 5 * 1024 * 1024) throw new Error('Processed photo exceeds size limit');
  const hash = createHash('sha256').update(output).digest('hex');
  try {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: destination, Body: output, ContentType: 'image/webp', Metadata: { sha256: hash }, IfNoneMatch: '*' }));
  } catch (error) {
    if (error.name !== 'PreconditionFailed') throw error;
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: destination }));
  }
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return destination;
}

export async function handler(event) {
  for (const record of event.Records || []) {
    const bucket = record.s3?.bucket?.name;
    const key = decodeURIComponent(record.s3?.object?.key?.replace(/\+/g, ' ') || '');
    if (!bucket || bucket !== process.env.S3_PHOTO_BUCKET) throw new Error('Unexpected photo bucket');
    await processPhoto({ bucket, key });
  }
}
