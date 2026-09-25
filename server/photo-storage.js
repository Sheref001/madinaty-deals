import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

const photoKey = key => /^active\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(key);
const storedKey = key => /^(active|closed)\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(key);

export function createPhotoStorage({ bucket, region, localStorage, client = new S3Client({ region }) }) {
  if (!bucket || !region) throw new Error('S3 photo bucket and region are required');
  const rawKey = key => key.replace(/^active\//, 'raw/');
  return {
    s3Photos: true,
    async presign(key, mimeType) {
      if (!photoKey(key)) throw new Error('Invalid photo key');
      return createPresignedPost(client, { Bucket: bucket, Key: rawKey(key), Expires: 300, Fields: { 'Content-Type': mimeType }, Conditions: [['content-length-range', 1, 5 * 1024 * 1024 + 16 * 1024], ['eq', '$Content-Type', mimeType]] });
    },
    async head(key) {
      if (!photoKey(key)) throw new Error('Invalid photo key');
      return client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    },
    async get(key) {
      if (!storedKey(key)) return localStorage.get(key);
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return result.Body.transformToByteArray();
    },
    async put(key, bytes) { return localStorage.put(key, bytes); },
    async remove(key) {
      if (!storedKey(key)) return localStorage.remove(key);
      await Promise.all([key, ...(photoKey(key) ? [rawKey(key)] : [])].map(Key => client.send(new DeleteObjectCommand({ Bucket: bucket, Key }))));
    },
    async archiveClosedAdPhoto(key) {
      if (!photoKey(key)) return;
      const destination = key.replace(/^active\//, 'closed/');
      let archived = false;
      try { await client.send(new HeadObjectCommand({ Bucket: bucket, Key: destination })); archived = true; }
      catch (error) { if (error.$metadata?.httpStatusCode !== 404 && error.name !== 'NotFound') throw error; }
      if (!archived) await client.send(new CopyObjectCommand({ Bucket: bucket, Key: destination, CopySource: `${bucket}/${key}` }));
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return destination;
    },
  };
}
