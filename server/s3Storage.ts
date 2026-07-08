import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

export const MAX_OUTCOME_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2048;
const JPEG_QUALITY = 82;

export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

export function readS3Config(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  const region = process.env.S3_REGION?.trim() || 'ru-1';
  const publicBaseUrl =
    process.env.S3_PUBLIC_BASE_URL?.trim()?.replace(/\/$/, '') ||
    `${endpoint.replace(/\/$/, '')}/${bucket}`;

  return { endpoint, bucket, region, accessKeyId, secretAccessKey, publicBaseUrl };
}

export function isS3Configured(): boolean {
  return readS3Config() !== null;
}

function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function isAllowedOutcomePhotoMime(mimeType: string): boolean {
  return ALLOWED_IMAGE_MIME.has(mimeType.toLowerCase());
}

export async function compressOutcomePhoto(buffer: Buffer, mimeType: string): Promise<Buffer> {
  const image = sharp(buffer, { failOn: 'none' }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('INVALID_IMAGE');
  }

  return image
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

export async function uploadOutcomePhotoToS3(
  buffer: Buffer,
  key: string,
  mimeType = 'image/jpeg'
): Promise<string> {
  const config = readS3Config();
  if (!config) throw new Error('S3_NOT_CONFIGURED');

  const client = createS3Client(config);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
      ...(process.env.S3_PUBLIC_READ === '1' ? { ACL: 'public-read' as const } : {}),
    })
  );

  return `${config.publicBaseUrl}/${key}`;
}

export function buildOutcomePhotoKey(
  theaterId: string,
  rehearsalId: string,
  fileId: string
): string {
  const safeTheater = theaterId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeRehearsal = rehearsalId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `rehearsal-outcomes/${safeTheater}/${safeRehearsal}/${fileId}.jpg`;
}

export function parseOutcomePhotoKeyFromUrl(url: string): string | null {
  const config = readS3Config();
  if (!config) return null;

  const normalized = url.trim();
  const prefix = `${config.publicBaseUrl}/`;
  if (!normalized.startsWith(prefix)) return null;
  const key = normalized.slice(prefix.length);
  if (!key.startsWith('rehearsal-outcomes/')) return null;
  return key;
}

export async function deleteOutcomePhotoFromS3(url: string): Promise<void> {
  const config = readS3Config();
  if (!config) throw new Error('S3_NOT_CONFIGURED');

  const key = parseOutcomePhotoKeyFromUrl(url);
  if (!key) throw new Error('INVALID_PHOTO_URL');

  const client = createS3Client(config);
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
}
