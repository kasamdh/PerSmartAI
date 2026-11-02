import { Directory, File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

/**
 * Downloads a signed URL into the cache and saves it to the phone's library.
 * Asks for write-only access; returns false if the user declines.
 */
export async function saveToPhone(url: string, type: 'photo' | 'video'): Promise<boolean> {
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) return false;
  const dir = new Directory(Paths.cache, 'saved-media');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const name = `${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`;
  const file = await File.downloadFileAsync(url, new File(dir, name));
  try {
    await Asset.create(file.uri);
  } finally {
    if (file.exists) file.delete();
  }
  return true;
}
