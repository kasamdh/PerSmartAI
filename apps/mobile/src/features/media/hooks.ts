import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import { visitKeys } from '@/features/care/hooks';

import { currentUploadQueue, onItemSent, startUploadQueue } from './queue-runtime';
import type { QueueItem, UploadQueue } from './upload-queue';

const EMPTY: readonly QueueItem[] = [];

/** Starts the sitter's upload queue and refreshes a visit's lists as items arrive. */
export function useStartUploadQueue() {
  const userId = useAuth().session?.user.id;
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    void startUploadQueue(userId);
    return onItemSent((item) => {
      void queryClient.invalidateQueries({
        queryKey:
          item.kind === 'media'
            ? visitKeys.photos(item.visitId)
            : visitKeys.careEvents(item.visitId),
      });
    });
  }, [userId, queryClient]);
}

/** The signed-in sitter's queue (null until started), and its items, live. */
export function useUploadQueue(): { queue: UploadQueue | null; items: readonly QueueItem[] } {
  const userId = useAuth().session?.user.id;
  const [queue, setQueue] = useState<UploadQueue | null>(() => currentUploadQueue());
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void startUploadQueue(userId).then((q) => alive && setQueue(q));
    return () => {
      alive = false;
    };
  }, [userId]);
  const items = useSyncExternalStore(
    (listener) => queue?.subscribe(listener) ?? (() => {}),
    () => queue?.items() ?? EMPTY,
  );
  return { queue, items };
}
