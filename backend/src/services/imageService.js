import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

const AVATAR_VARIANTS = [
  { name: 'thumb', size: 64,  quality: 80 },
  { name: 'sm',    size: 128, quality: 80 },
  { name: 'md',    size: 256, quality: 85 },
  { name: 'lg',    size: 512, quality: 85 },
];

/**
 * Process an uploaded avatar image into multiple variants.
 * Generates WebP (primary) + JPEG (fallback) for each size.
 * @param {string} inputPath - Path to the uploaded temp file
 * @param {string} userId - User ID (used as directory name)
 * @returns {Promise<void>}
 */
export async function processAvatarUpload(inputPath, userId) {
  const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
  const userAvatarDir = path.join(uploadDir, 'avatars', userId);

  await fs.mkdir(userAvatarDir, { recursive: true });

  const inputBuffer = await fs.readFile(inputPath);
  const metadata = await sharp(inputBuffer).metadata();

  if ((metadata.width || 0) < 100 || (metadata.height || 0) < 100) {
    throw { status: 400, message: 'รูปภาพต้องมีขนาดอย่างน้อย 100×100 pixels' };
  }

  for (const variant of AVATAR_VARIANTS) {
    await sharp(inputBuffer)
      .resize(variant.size, variant.size, { fit: 'cover', position: 'centre' })
      .webp({ quality: variant.quality })
      .toFile(path.join(userAvatarDir, `${variant.name}.webp`));

    await sharp(inputBuffer)
      .resize(variant.size, variant.size, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: variant.quality, progressive: true })
      .toFile(path.join(userAvatarDir, `${variant.name}.jpg`));
  }

  await sharp(inputBuffer)
    .webp({ quality: 90 })
    .toFile(path.join(userAvatarDir, 'original.webp'));

  await fs.unlink(inputPath).catch(() => {});
}

/**
 * Delete all avatar files for a user.
 * @param {string} userId - User ID
 */
export async function deleteAvatarFiles(userId) {
  const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
  const userAvatarDir = path.join(uploadDir, 'avatars', userId);
  await fs.rm(userAvatarDir, { recursive: true, force: true });
}
