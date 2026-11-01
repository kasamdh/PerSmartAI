// Turns a picked or captured photo/video into a queue item: photos are compressed
// to 1080 px wide (JPEG 0.7) with a 300 px thumbnail; videos (15 s max) are copied
// as-is with a thumbnail from their first frame. Files live in the app's document
// directory until they're uploaded, so the OS can't clear them like the cache.

import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getThumbnailAsync } from 'expo-video-thumbnails';

import { targetWidth } from '@/lib/image-utils';

import {
  checkVideoLength,
  JPEG_QUALITY,
  PHOTO_MAX_WIDTH,
  THUMB_WIDTH,
  uuidv4,
  videoContentType,
} from './media-logic';
import type { NewQueueItem } from './upload-queue';

export type PickedMedia = {
  uri: string;
  type: 'photo' | 'video';
  width: number;
  height: number;
  /** Milliseconds (videos). */
  durationMs?: number | null;
};

export function queueDirectory(): Directory {
  const dir = new Directory(Paths.document, 'media-queue');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

async function jpeg(uri: string, width: number, maxWidth: number, name: string) {
  const rendered = await ImageManipulator.manipulate(uri)
    .resize({ width: targetWidth(width, maxWidth) })
    .renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  const target = new File(queueDirectory(), name);
  if (target.exists) target.delete();
  new File(saved.uri).move(target);
  return { uri: target.uri, width: saved.width, height: saved.height };
}

export async function prepareMedia(
  picked: PickedMedia,
  context: { visitId: string; organizationId: string; petIds: string[]; caption: string },
): Promise<NewQueueItem> {
  const id = uuidv4();
  const base = {
    kind: 'media' as const,
    id,
    visitId: context.visitId,
    organizationId: context.organizationId,
    petIds: context.petIds,
    caption: context.caption.trim() || null,
  };

  if (picked.type === 'photo') {
    const full = await jpeg(picked.uri, picked.width, PHOTO_MAX_WIDTH, `${id}.jpg`);
    const thumb = await jpeg(full.uri, full.width, THUMB_WIDTH, `${id}-thumb.jpg`);
    return {
      ...base,
      mediaType: 'photo',
      fileUri: full.uri,
      thumbUri: thumb.uri,
      width: full.width,
      height: full.height,
      durationSeconds: null,
    };
  }

  const length = checkVideoLength(picked.durationMs);
  if (!length.ok) throw new Error(length.error);
  const target = new File(queueDirectory(), `${id}.${videoContentType(picked.uri).ext}`);
  new File(picked.uri).copy(target);
  const frame = await getThumbnailAsync(picked.uri, { time: 0, quality: JPEG_QUALITY });
  const thumb = await jpeg(frame.uri, frame.width, THUMB_WIDTH, `${id}-thumb.jpg`);
  return {
    ...base,
    mediaType: 'video',
    fileUri: target.uri,
    thumbUri: thumb.uri,
    width: picked.width || frame.width,
    height: picked.height || frame.height,
    durationSeconds: length.seconds,
  };
}
