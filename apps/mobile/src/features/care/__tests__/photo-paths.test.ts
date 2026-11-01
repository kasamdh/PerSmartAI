import { base64ToArrayBuffer, buildPhotoPaths, targetWidth } from '../photo-paths';

describe('buildPhotoPaths', () => {
  it('follows the {org}/{visit}/{file} layout the storage policies require', () => {
    const { storagePath, thumbPath } = buildPhotoPaths(
      'org-1',
      'visit-1',
      new Date(1_700_000_000_000),
      () => 0.123456789,
    );
    const parts = storagePath.split('/');

    expect(parts).toHaveLength(3);
    expect(parts.slice(0, 2)).toEqual(['org-1', 'visit-1']);
    expect(storagePath).toMatch(/^org-1\/visit-1\/1700000000000-[a-z0-9]+\.jpg$/);
    expect(thumbPath).toBe(storagePath.replace('.jpg', '-thumb.jpg'));
  });

  it('gives different photos different names', () => {
    const a = buildPhotoPaths('o', 'v');
    const b = buildPhotoPaths('o', 'v');
    expect(a.storagePath).not.toBe(b.storagePath);
  });
});

describe('targetWidth', () => {
  it('never upscales and never exceeds the max', () => {
    expect(targetWidth(4032, 1600)).toBe(1600);
    expect(targetWidth(800, 1600)).toBe(800);
    expect(targetWidth(0, 400)).toBe(1);
  });
});

describe('base64ToArrayBuffer', () => {
  it('decodes bytes exactly', () => {
    const bytes = new Uint8Array(base64ToArrayBuffer('/9j/4AAQ')); // JPEG magic bytes
    expect(Array.from(bytes)).toEqual([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  });
});
