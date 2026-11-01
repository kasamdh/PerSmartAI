// Pure helpers for visit media: storage paths, limits, ids, and merging the
// sitter's unsent care events with what the server has.

import { toDateString } from '@/lib/wall-clock';

import type { QueueStatus } from './upload-queue';

export const PHOTO_MAX_WIDTH = 1080;
export const THUMB_WIDTH = 300;
export const JPEG_QUALITY = 0.7;
export const MAX_VIDEO_SECONDS = 15;
export const MAX_PICK = 10;

export function videoContentType(uri: string): { ext: 'mp4' | 'mov'; type: string } {
  return /\.mov($|\?)/i.test(uri)
    ? { ext: 'mov', type: 'video/quicktime' }
    : { ext: 'mp4', type: 'video/mp4' };
}

/** `{organization_id}/{visit_id}/{uuid}.jpg|.mp4|.mov` plus `{uuid}-thumb.jpg`. */
export function mediaPaths(
  organizationId: string,
  visitId: string,
  id: string,
  type: 'photo' | 'video',
  sourceUri = '',
): { storagePath: string; thumbPath: string; contentType: string } {
  const folder = `${organizationId}/${visitId}`;
  const video = type === 'video' ? videoContentType(sourceUri) : null;
  return {
    storagePath: `${folder}/${id}.${video ? video.ext : 'jpg'}`,
    thumbPath: `${folder}/${id}-thumb.jpg`,
    contentType: video ? video.type : 'image/jpeg',
  };
}

export function checkVideoLength(
  durationMs: number | null | undefined,
): { ok: true; seconds: number } | { ok: false; error: string } {
  if (durationMs === null || durationMs === undefined || !(durationMs > 0)) {
    return { ok: false, error: 'Couldn’t read this video’s length.' };
  }
  const seconds = Math.round(durationMs / 100) / 10;
  if (seconds > MAX_VIDEO_SECONDS + 0.4) {
    return {
      ok: false,
      error: `Videos can be up to ${MAX_VIDEO_SECONDS} seconds. This one is ${Math.round(seconds)} seconds.`,
    };
  }
  return { ok: true, seconds };
}

/** A random (version 4) UUID; uses crypto.randomUUID when the platform has it. */
export function uuidv4(): string {
  const native = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;
  if (native) return native.call(globalThis.crypto);
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16));
  hex[12] = 4;
  hex[16] = (hex[16] & 0x3) | 0x8;
  const s = hex.map((n) => n.toString(16)).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

type ServerEvent = {
  id: string;
  type: string;
  value: unknown;
  occurred_at: string;
  pet_id: string | null;
};

type PendingCareEvent = {
  kind: 'care_event';
  op: 'insert' | 'update';
  id: string;
  type: string;
  value: Record<string, unknown>;
  occurredAt: string;
  petId: string | null;
  status: QueueStatus;
};

/**
 * The visit's care log as the sitter should see it: server events plus the ones
 * still in the offline queue (marked pending), newest first.
 */
export function mergePendingCareEvents<E extends ServerEvent>(
  server: readonly E[],
  pending: readonly PendingCareEvent[],
): (E & { pending: boolean })[] {
  const byId = new Map<string, E & { pending: boolean }>();
  for (const e of server) byId.set(e.id, { ...e, pending: false });
  for (const p of pending) {
    if (p.status === 'sent') continue;
    const existing = byId.get(p.id);
    if (existing) {
      if (p.op === 'update') byId.set(p.id, { ...existing, value: p.value, pending: true });
      continue;
    }
    byId.set(p.id, {
      id: p.id,
      type: p.type,
      value: p.value,
      occurred_at: p.occurredAt,
      pet_id: p.petId,
      pending: true,
    } as unknown as E & { pending: boolean });
  }
  return [...byId.values()].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

/** Gallery sections: one per visit day (device-local), newest first. */
export function groupByVisitDate<T extends { visitStart: string; created_at: string }>(
  items: readonly T[],
): { date: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const date = toDateString(new Date(item.visitStart));
    groups.set(date, [...(groups.get(date) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({
      date,
      items: list.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }));
}

const STATUS_LABELS: Record<QueueStatus, string> = {
  queued: 'Uploading…',
  uploading: 'Uploading…',
  sent: 'Sent',
  waiting: 'Waiting for signal',
  failed: 'Failed',
};

export function queueStatusLabel(status: QueueStatus): string {
  return STATUS_LABELS[status];
}
