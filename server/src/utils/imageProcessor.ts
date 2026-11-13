import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadFile } from '../config/s3';

const localUploadsRoot = path.resolve(__dirname, '../../uploads');

/**
 * Converts a base64 data:image URI into a compressed static WebP file on disk (/uploads/...)
 * so JSON API responses and PostgreSQL rows store a 45-byte URL instead of multi-MB base64 strings.
 */
export const persistBase64Image = async (
  imgStr: string,
  folder: string = 'products',
  maxDim: number = 800,
  quality: number = 80
): Promise<string> => {
  if (!imgStr || typeof imgStr !== 'string') return imgStr;
  if (!imgStr.startsWith('data:image/')) {
    // Strip hardcoded localhost origin if present so stored path is portable across LAN/devices
    return imgStr.replace(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+\/uploads\//i, '/uploads/');
  }

  try {
    const match = imgStr.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) return imgStr;

    const rawBuffer = Buffer.from(match[2], 'base64');
    const hash = crypto.createHash('sha1').update(rawBuffer).digest('hex').slice(0, 24);
    const relPath = `${folder}/${hash}.webp`;
    const absPath = path.resolve(localUploadsRoot, relPath);

    if (!fs.existsSync(absPath)) {
      await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
      const webpBuffer = await sharp(rawBuffer)
        .rotate()
        .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
      await fs.promises.writeFile(absPath, webpBuffer);
    }

    return `/uploads/${relPath}`;
  } catch {
    return imgStr;
  }
};

export const persistImagesArray = async (
  images?: string[],
  folder: string = 'products'
): Promise<string[]> => {
  if (!Array.isArray(images)) return [];
  return Promise.all(images.map((img) => persistBase64Image(img, folder)));
};

const getFileExtension = (mimeType: string): string => {
  const normalized = (mimeType || '').toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('heic')) return 'heic';
  if (normalized.includes('heif')) return 'heif';
  return 'jpg';
};

interface ImageVariant {
  suffix: string;
  width: number;
  height: number;
}

const IMAGE_VARIANTS: ImageVariant[] = [
  { suffix: 'thumb', width: 150, height: 150 },
  { suffix: 'card', width: 400, height: 400 },
  { suffix: 'full', width: 1200, height: 1200 },
];

interface ProcessedImage {
  thumbnail: string;
  card: string;
  full: string;
  original: string;
}

/**
 * Process and upload an image to storage in multiple sizes.
 */
export const processAndUploadImage = async (
  buffer: Buffer,
  folder: string = 'products',
  addWatermark: boolean = false,
  publicBaseUrl?: string,
  mimeType: string = 'image/jpeg'
): Promise<ProcessedImage> => {
  const id = uuidv4();

  const urls: Record<string, string> = {};

  try {
    for (const variant of IMAGE_VARIANTS) {
      let pipeline = sharp(buffer)
        .resize(variant.width, variant.height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 80 });

      // Add watermark to full-size image
      if (addWatermark && variant.suffix === 'full') {
        const watermarkSvg = Buffer.from(`
          <svg width="${variant.width}" height="40">
            <text x="10" y="30" font-family="Arial" font-size="14"
              fill="rgba(255,255,255,0.4)" font-weight="bold">
              CityLocalShop
            </text>
          </svg>
        `);

        const image = await pipeline.toBuffer();
        pipeline = sharp(image).composite([{
          input: watermarkSvg,
          gravity: 'southeast',
        }]);
      }

      const processedBuffer = await pipeline.toBuffer();
      const key = `${folder}/${id}-${variant.suffix}.webp`;
      const url = await uploadFile(key, processedBuffer, 'image/webp', publicBaseUrl);
      urls[variant.suffix] = url;
    }

    // Upload original
    const originalKey = `${folder}/${id}-original.webp`;
    const originalBuffer = await sharp(buffer).webp({ quality: 90 }).toBuffer();
    const originalUrl = await uploadFile(originalKey, originalBuffer, 'image/webp', publicBaseUrl);

    return {
      thumbnail: urls.thumb,
      card: urls.card,
      full: urls.full,
      original: originalUrl,
    };
  } catch (error) {
    // Fallback for unsupported/undecodable formats: store original media so product save does not fail.
    const ext = getFileExtension(mimeType);
    const key = `${folder}/${id}-original.${ext}`;
    const originalUrl = await uploadFile(key, buffer, mimeType || 'application/octet-stream', publicBaseUrl);
    return {
      thumbnail: originalUrl,
      card: originalUrl,
      full: originalUrl,
      original: originalUrl,
    };
  }
};

/**
 * Process a single image to a specific size (for avatars, logos, etc.)
 */
export const processAvatar = async (buffer: Buffer, folder: string = 'avatars'): Promise<string> => {
  const id = uuidv4();

  const processed = await sharp(buffer)
    .resize(200, 200, { fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer();

  const key = `${folder}/${id}.webp`;
  return uploadFile(key, processed, 'image/webp');
};

/**
 * Get image metadata
 */
export const getImageMetadata = async (buffer: Buffer) => {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: metadata.size,
  };
};
