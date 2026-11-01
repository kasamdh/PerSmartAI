import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { base64ToArrayBuffer, targetWidth } from './image-utils';
import { supabase } from './supabase';

export { uniqueJpegName } from './image-utils';

export const PET_MEDIA_BUCKET = 'pet-media';

export type CompressedImage = {
  /** Local file URI of the compressed JPEG (for previews). */
  uri: string;
  width: number;
  height: number;
  /** JPEG bytes ready to upload. */
  data: ArrayBuffer;
};

/** Resizes to at most `maxWidth` px wide (keeping aspect ratio) and re-encodes as JPEG. */
export async function compressImage(
  uri: string,
  originalWidth: number,
  { maxWidth, quality = 0.7 }: { maxWidth: number; quality?: number },
): Promise<CompressedImage> {
  const rendered = await ImageManipulator.manipulate(uri)
    .resize({ width: targetWidth(originalWidth, maxWidth) })
    .renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: quality,
    base64: true,
  });
  if (!saved.base64) {
    throw new Error('Could not process the photo.');
  }
  return {
    uri: saved.uri,
    width: saved.width,
    height: saved.height,
    data: base64ToArrayBuffer(saved.base64),
  };
}

/** Uploads JPEG bytes to the private pet-media bucket at `path`. */
export async function uploadToPetMedia(path: string, data: ArrayBuffer): Promise<void> {
  const { error } = await supabase.storage
    .from(PET_MEDIA_BUCKET)
    .upload(path, data, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
}

/** Best-effort removal (e.g. a replaced pet photo). */
export async function removeFromPetMedia(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(PET_MEDIA_BUCKET).remove(paths);
}

/** Short-lived URL for showing a private image. */
export async function signedPetMediaUrl(path: string, expiresIn = 60 * 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PET_MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
