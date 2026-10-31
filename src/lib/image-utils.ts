/** Width to resize to: never upscale, never exceed `max`. */
export function targetWidth(originalWidth: number, max: number): number {
  return Math.max(1, Math.min(Math.round(originalWidth), max));
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** A unique file name like "1730390400000-k3j9x2.jpg". */
export function uniqueJpegName(now: Date = new Date(), random: () => number = Math.random): string {
  return `${now.getTime()}-${random().toString(36).slice(2, 10)}.jpg`;
}
