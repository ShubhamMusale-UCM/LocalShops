import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET = process.env.AWS_S3_BUCKET || 'citylocalshop-uploads';

const hasValidAwsCredentials = () => {
  return (
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_ACCESS_KEY_ID.trim() !== '' &&
    process.env.AWS_SECRET_ACCESS_KEY.trim() !== ''
  );
};

const getServerBaseUrl = () => {
  const base = (process.env.PUBLIC_BASE_URL || process.env.CDN_BASE_URL || 'http://localhost:5000').trim();
  return base.replace(/\/+$/, '');
};

const uploadRoot = path.resolve(__dirname, '../../uploads');

export const uploadFile = async (
  key: string,
  body: Buffer,
  contentType: string,
  publicBaseUrl?: string
): Promise<string> => {
  if (!hasValidAwsCredentials()) {
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const outputPath = path.resolve(uploadRoot, normalizedKey);
    const outputDir = path.dirname(outputPath);

    await fsPromises.mkdir(outputDir, { recursive: true });
    await fsPromises.writeFile(outputPath, body);

    const base = (publicBaseUrl || getServerBaseUrl()).replace(/\/+$/, '');
    return `${base}/uploads/${normalizedKey}`;
  }

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: 'public-read',
  }));

  const cdnBase = process.env.CDN_BASE_URL;
  return cdnBase
    ? `${cdnBase}/${key}`
    : `https://${BUCKET}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;
};

export const deleteFile = async (key: string): Promise<void> => {
  if (!hasValidAwsCredentials()) {
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const outputPath = path.resolve(uploadRoot, normalizedKey);
    if (fs.existsSync(outputPath)) {
      await fsPromises.unlink(outputPath);
    }
    return;
  }

  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

export const getPresignedUrl = async (key: string, expiresIn: number = 3600): Promise<string> => {
  if (!hasValidAwsCredentials()) {
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    return `${getServerBaseUrl()}/uploads/${normalizedKey}`;
  }

  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
};

export default s3Client;
