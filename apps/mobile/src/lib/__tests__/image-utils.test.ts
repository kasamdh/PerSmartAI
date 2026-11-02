import { base64ToArrayBuffer, targetWidth, uniqueJpegName } from '../image-utils';

describe('targetWidth', () => {
  it('shrinks large photos to the maximum and never upscales small ones', () => {
    expect(targetWidth(4032, 1080)).toBe(1080);
    expect(targetWidth(640.4, 1080)).toBe(640);
    expect(targetWidth(0, 300)).toBe(1);
  });
});

describe('base64ToArrayBuffer', () => {
  it('decodes bytes exactly (JPEG magic number)', () => {
    expect([...new Uint8Array(base64ToArrayBuffer('/9j/4A=='))]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });
});

describe('uniqueJpegName', () => {
  it('combines the time and a random part', () => {
    expect(uniqueJpegName(new Date(1730390400000), () => 0.5)).toBe('1730390400000-i.jpg');
    expect(uniqueJpegName()).toMatch(/^\d+-[a-z0-9]+\.jpg$/);
  });
});
