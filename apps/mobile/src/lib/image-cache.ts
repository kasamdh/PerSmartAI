/**
 * expo-image source for a signed storage URL, cached on disk by the file's path.
 * Signed URLs get a new token each time they're signed (at most hourly), which
 * would otherwise download the same photo again; storage paths are unique per
 * file (new uploads get new names), so the path is a safe cache key.
 */
export function cachedImageSource(uri: string): { uri: string; cacheKey?: string } {
  const signed = uri.indexOf('/storage/v1/object/sign/');
  if (signed === -1) return { uri };
  return { uri, cacheKey: uri.slice(signed).replace(/[?#].*$/, '') };
}
