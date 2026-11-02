import { cachedImageSource } from '../image-cache';

describe('cachedImageSource', () => {
  it('caches signed storage URLs by path, so a new token reuses the cached file', () => {
    const a = cachedImageSource(
      'https://x.supabase.co/storage/v1/object/sign/pet-media/org/visit/p1-thumb.jpg?token=aaa',
    );
    const b = cachedImageSource(
      'https://x.supabase.co/storage/v1/object/sign/pet-media/org/visit/p1-thumb.jpg?token=bbb',
    );
    expect(a.cacheKey).toBe('/storage/v1/object/sign/pet-media/org/visit/p1-thumb.jpg');
    expect(b.cacheKey).toBe(a.cacheKey);
    expect(b.uri).toContain('token=bbb');
  });

  it('leaves local files alone', () => {
    expect(cachedImageSource('file:///queue/p1.jpg')).toEqual({ uri: 'file:///queue/p1.jpg' });
  });
});
