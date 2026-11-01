// The device side of the upload queue: persistence (AsyncStorage, per user), local
// files (expo-file-system), connectivity (expo-network) and the actual uploads.
// The queue logic itself is in upload-queue.ts and is tested without a device.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { PET_MEDIA_BUCKET } from '@/lib/images';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

import { mediaPaths } from './media-logic';
import { UploadQueue, type QueueItem } from './upload-queue';

const storageKey = (userId: string) => `media-upload-queue:v1:${userId}`;

async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return !!state.isConnected && state.isInternetReachable !== false;
  } catch {
    return true; // can't tell: try, and let the upload error decide
  }
}

function throwUnlessDuplicate(error: { message: string; statusCode?: string } | null) {
  if (!error) return;
  if (error.statusCode === '409' || /already exists|duplicate/i.test(error.message)) return;
  throw error;
}

async function uploadItem(item: QueueItem): Promise<void> {
  if (item.kind === 'care_event') {
    if (item.op === 'insert') {
      const { error } = await supabase.from('care_events').insert({
        id: item.id,
        visit_id: item.visitId,
        pet_id: item.petId,
        type: item.type as never,
        value: item.value as { [key: string]: Json | undefined },
        occurred_at: item.occurredAt,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('care_events')
        .update({ value: item.value as { [key: string]: Json | undefined } })
        .eq('id', item.id);
      if (error) throw error;
    }
    return;
  }

  const { storagePath, thumbPath, contentType } = mediaPaths(
    item.organizationId,
    item.visitId,
    item.id,
    item.mediaType,
    item.fileUri,
  );
  const bucket = supabase.storage.from(PET_MEDIA_BUCKET);
  // A retry after a partial upload finds the files already there; that's fine.
  const full = await bucket.upload(storagePath, await new File(item.fileUri).bytes(), {
    contentType,
    upsert: false,
  });
  throwUnlessDuplicate(full.error as never);
  const thumb = await bucket.upload(thumbPath, await new File(item.thumbUri).bytes(), {
    contentType: 'image/jpeg',
    upsert: false,
  });
  throwUnlessDuplicate(thumb.error as never);

  const { error } = await supabase.from('media').insert({
    id: item.id,
    visit_id: item.visitId,
    pet_id: item.petIds[0] ?? null,
    storage_path: storagePath,
    thumb_path: thumbPath,
    type: item.mediaType,
    caption: item.caption,
    duration_seconds: item.durationSeconds,
    width: item.width,
    height: item.height,
  });
  if (error && error.code !== '23505') throw error;

  if (item.petIds.length > 0) {
    const { error: tagError } = await supabase.from('media_pets').upsert(
      item.petIds.map((pet_id) => ({ media_id: item.id, pet_id })),
      { onConflict: 'media_id,pet_id', ignoreDuplicates: true },
    );
    if (tagError) throw tagError;
  }
}

async function cleanupItem(item: QueueItem): Promise<void> {
  if (item.kind !== 'media') return;
  for (const uri of [item.fileUri, item.thumbUri]) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // Already gone.
    }
  }
}

type Runtime = { userId: string; queue: UploadQueue; stop: () => void };
let runtime: Runtime | null = null;
const sentListeners = new Set<(item: QueueItem) => void>();

/** Called when an item reaches the server (e.g. to refresh that visit's lists). */
export function onItemSent(listener: (item: QueueItem) => void): () => void {
  sentListeners.add(listener);
  return () => sentListeners.delete(listener);
}

/** Starts (or returns) the signed-in sitter's queue and its background triggers. */
export async function startUploadQueue(userId: string): Promise<UploadQueue> {
  if (runtime?.userId === userId) return runtime.queue;
  runtime?.stop();

  const queue = new UploadQueue({
    load: async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        return raw ? (JSON.parse(raw) as QueueItem[]) : [];
      } catch {
        return [];
      }
    },
    save: (items) => AsyncStorage.setItem(storageKey(userId), JSON.stringify(items)),
    isOnline,
    upload: uploadItem,
    cleanup: cleanupItem,
    now: () => new Date(),
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  let sent = new Set<string>();
  const unsubscribe = queue.subscribe(() => {
    // Tell listeners about newly sent items.
    const nowSent = new Set<string>();
    for (const item of queue.items()) {
      const key = `${item.kind}:${item.id}:${item.kind === 'care_event' ? item.op : ''}`;
      if (item.status !== 'sent') continue;
      nowSent.add(key);
      if (!sent.has(key)) sentListeners.forEach((l) => l(item));
    }
    sent = nowSent;
    // Wake up for the next backed-off retry.
    clearTimeout(timer);
    const wake = queue.nextWakeAt();
    if (wake)
      timer = setTimeout(() => void queue.process(), Math.max(1000, wake.getTime() - Date.now()));
  });

  const network = Network.addNetworkStateListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) void queue.process();
  });
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void queue.pruneSent();
      void queue.process();
    }
  });

  runtime = {
    userId,
    queue,
    stop: () => {
      clearTimeout(timer);
      unsubscribe();
      network.remove();
      appState.remove();
    },
  };
  await queue.init();
  sent = new Set(
    queue
      .items()
      .filter((i) => i.status === 'sent')
      .map((i) => `${i.kind}:${i.id}:${i.kind === 'care_event' ? i.op : ''}`),
  );
  await queue.pruneSent();
  void queue.process();
  return queue;
}

export function currentUploadQueue(): UploadQueue | null {
  return runtime?.queue ?? null;
}
