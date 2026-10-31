export { base64ToArrayBuffer, targetWidth } from '@/lib/image-utils';

export const PET_MEDIA_BUCKET = 'pet-media';
export const PHOTO_MAX_WIDTH = 1600;
export const THUMB_WIDTH = 400;

/**
 * Storage paths for a visit photo and its thumbnail. Must match the storage
 * policy layout `{organization_id}/{visit_id}/{file}`.
 */
export function buildPhotoPaths(
  organizationId: string,
  visitId: string,
  now: Date = new Date(),
  random: () => number = Math.random,
): { storagePath: string; thumbPath: string } {
  const name = `${now.getTime()}-${random().toString(36).slice(2, 10)}`;
  return {
    storagePath: `${organizationId}/${visitId}/${name}.jpg`,
    thumbPath: `${organizationId}/${visitId}/${name}-thumb.jpg`,
  };
}
