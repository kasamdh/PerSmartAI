// The sitter's offline upload queue for visit photos, videos and care events.
//
// Everything a sitter captures goes in here first and is persisted, so nothing is
// lost without signal or when the app is killed. Each item has an id made on the
// phone, which becomes the row id on the server: if a retry repeats an upload that
// already arrived, the duplicate is recognised and the item counts as sent.
//
// Statuses: queued (about to send, or retrying soon) -> uploading -> sent;
// waiting (no signal; sends when it comes back); failed (needs a manual retry).
// The core is pure TypeScript with injected storage, network and uploader.

export type QueueStatus = 'queued' | 'uploading' | 'sent' | 'waiting' | 'failed';

type QueueBase = {
  id: string;
  visitId: string;
  createdAt: string;
  status: QueueStatus;
  attempts: number;
  /** Not before this time (backoff after a server error). */
  nextAttemptAt: string | null;
  lastError: string | null;
};

export type MediaQueueItem = QueueBase & {
  kind: 'media';
  organizationId: string;
  mediaType: 'photo' | 'video';
  /** Local copies made for the queue (deleted once sent). */
  fileUri: string;
  thumbUri: string;
  width: number;
  height: number;
  durationSeconds: number | null;
  petIds: string[];
  caption: string | null;
};

export type CareEventQueueItem = QueueBase & {
  kind: 'care_event';
  op: 'insert' | 'update';
  petId: string | null;
  type: string;
  value: Record<string, unknown>;
  /** When it happened on the phone, kept even if it's sent much later. */
  occurredAt: string;
};

export type QueueItem = MediaQueueItem | CareEventQueueItem;

type QueueFields = keyof QueueBase;
export type NewQueueItem =
  | Omit<MediaQueueItem, Exclude<QueueFields, 'id' | 'visitId'>>
  | Omit<CareEventQueueItem, Exclude<QueueFields, 'id' | 'visitId'>>;

export type QueueDeps = {
  load(): Promise<QueueItem[]>;
  save(items: QueueItem[]): Promise<void>;
  isOnline(): Promise<boolean>;
  /** Sends one item; throws on failure (see classifyUploadError). */
  upload(item: QueueItem): Promise<void>;
  /** Deletes the item's local files. */
  cleanup(item: QueueItem): Promise<void>;
  now(): Date;
};

export const MAX_ATTEMPTS = 5;
const SENT_RETENTION_MS = 24 * 3_600_000;

/** 30 s, 1 min, 2 min … capped at 10 min. */
export function backoffMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 10 * 60_000);
}

export type UploadErrorKind = 'offline' | 'duplicate' | 'retry' | 'permanent';

/** What to do about an upload error. Unknown errors are retried. */
export function classifyUploadError(error: unknown): UploadErrorKind {
  const e = (error ?? {}) as {
    name?: string;
    message?: string;
    code?: string;
    status?: number | string;
    statusCode?: number | string;
  };
  const message = String(e.message ?? '').toLowerCase();
  if (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('the internet connection appears to be offline')
  ) {
    return 'offline';
  }
  if (e.code === '23505' || message.includes('already exists') || message.includes('duplicate')) {
    return 'duplicate';
  }
  const status = Number(e.statusCode ?? e.status);
  if (Number.isFinite(status) && status > 0) {
    if (status === 409) return 'duplicate';
    if (status === 401 || status === 408 || status === 429 || status >= 500) return 'retry';
    if (status >= 400) return 'permanent';
  }
  // Postgres errors a retry can't fix: permissions, check/foreign key violations, bad input.
  if (e.code && /^(42501|23\d{3}|22\d{3}|P0002)$/.test(e.code)) return 'permanent';
  return 'retry';
}

const PENDING: QueueStatus[] = ['queued', 'waiting', 'uploading'];

export class UploadQueue {
  private list: QueueItem[] = [];
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private again = false;

  constructor(private readonly deps: QueueDeps) {}

  /** Loads the persisted queue. An upload interrupted by the app closing is retried. */
  async init(): Promise<void> {
    const saved = await this.deps.load();
    this.list = saved.map((i) => (i.status === 'uploading' ? { ...i, status: 'queued' } : i));
    this.notify();
  }

  items(): readonly QueueItem[] {
    return this.list;
  }

  /** Items for a visit that haven't reached the server yet. */
  pendingFor(visitId: string): QueueItem[] {
    return this.list.filter((i) => i.visitId === visitId && i.status !== 'sent');
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The next time a backed-off item may be tried, or null. */
  nextWakeAt(): Date | null {
    const times = this.list
      .filter((i) => i.status === 'queued' && i.nextAttemptAt)
      .map((i) => Date.parse(i.nextAttemptAt!));
    return times.length ? new Date(Math.min(...times)) : null;
  }

  async enqueue(input: NewQueueItem): Promise<void> {
    const item = {
      ...input,
      createdAt: this.deps.now().toISOString(),
      status: 'queued',
      attempts: 0,
      nextAttemptAt: null,
      lastError: null,
    } as QueueItem;
    this.list = [...this.list, item];
    await this.persist();
    await this.process();
  }

  /** A care event's new value; folded into its insert when that hasn't been sent. */
  async updateCareEvent(
    id: string,
    visitId: string,
    value: Record<string, unknown>,
  ): Promise<void> {
    const pendingInsert = this.list.find(
      (i) =>
        i.kind === 'care_event' &&
        i.id === id &&
        i.op === 'insert' &&
        (i.status === 'queued' || i.status === 'waiting' || i.status === 'failed'),
    );
    if (pendingInsert) {
      this.list = this.list.map((i) => (i === pendingInsert ? { ...i, value } : i));
      await this.persist();
      await this.process();
      return;
    }
    const original = this.list.find((i) => i.kind === 'care_event' && i.id === id) as
      CareEventQueueItem | undefined;
    await this.enqueue({
      kind: 'care_event',
      op: 'update',
      id,
      visitId,
      petId: original?.petId ?? null,
      type: original?.type ?? 'walk',
      value,
      occurredAt: original?.occurredAt ?? this.deps.now().toISOString(),
    });
  }

  /** Removes an item that hasn't been sent. False if it's sent or sending. */
  async cancel(id: string): Promise<boolean> {
    const items = this.list.filter(
      (i) => i.id === id && i.status !== 'sent' && i.status !== 'uploading',
    );
    if (items.length === 0) return false;
    this.list = this.list.filter((i) => !items.includes(i));
    await this.persist();
    for (const item of items) await this.deps.cleanup(item);
    return true;
  }

  /** Tries a failed item again from scratch. */
  async retry(id: string): Promise<void> {
    this.list = this.list.map((i) =>
      i.id === id && i.status === 'failed'
        ? { ...i, status: 'queued', attempts: 0, nextAttemptAt: null, lastError: null }
        : i,
    );
    await this.persist();
    await this.process();
  }

  /** Drops sent items older than a day (they're on the server now). */
  async pruneSent(): Promise<void> {
    const cutoff = this.deps.now().getTime() - SENT_RETENTION_MS;
    const before = this.list.length;
    this.list = this.list.filter((i) => i.status !== 'sent' || Date.parse(i.createdAt) > cutoff);
    if (this.list.length !== before) await this.persist();
  }

  /** Sends what it can, one item at a time. Concurrent calls share one loop. */
  process(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.drain();
        } while (this.again);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private async drain(): Promise<void> {
    for (;;) {
      if (!(await this.deps.isOnline())) {
        await this.markWaiting();
        return;
      }
      const now = this.deps.now().getTime();
      const next = this.list.find(
        (i) =>
          (i.status === 'queued' || i.status === 'waiting') &&
          (!i.nextAttemptAt || Date.parse(i.nextAttemptAt) <= now),
      );
      if (!next) return;

      this.replace(next.id, next, { status: 'uploading' });
      await this.persist();
      const current = this.find(next)!;
      try {
        await this.deps.upload(current);
        await this.succeed(current);
      } catch (error) {
        const kind = classifyUploadError(error);
        const message =
          error instanceof Error
            ? error.message
            : String((error as { message?: unknown })?.message ?? error);
        if (kind === 'duplicate') {
          await this.succeed(current);
        } else if (kind === 'offline') {
          this.replace(current.id, current, { status: 'waiting' });
          await this.markWaiting();
          return;
        } else {
          const attempts = current.attempts + 1;
          const failed = kind === 'permanent' || attempts >= MAX_ATTEMPTS;
          this.replace(current.id, current, {
            attempts,
            lastError: message,
            status: failed ? 'failed' : 'queued',
            nextAttemptAt: failed ? null : new Date(now + backoffMs(attempts)).toISOString(),
          });
          await this.persist();
        }
      }
    }
  }

  private async succeed(item: QueueItem) {
    this.replace(item.id, item, {
      status: 'sent',
      attempts: item.attempts + 1,
      nextAttemptAt: null,
      lastError: null,
    });
    await this.persist();
    await this.deps.cleanup(item);
  }

  private async markWaiting() {
    let changed = false;
    this.list = this.list.map((i) => {
      if (i.status === 'queued' && !i.nextAttemptAt) {
        changed = true;
        return { ...i, status: 'waiting' };
      }
      return i;
    });
    if (changed) await this.persist();
    else this.notify();
  }

  private find(item: QueueItem): QueueItem | undefined {
    return this.list.find((i) => i.id === item.id && i.kind === item.kind && this.sameOp(i, item));
  }

  private sameOp(a: QueueItem, b: QueueItem) {
    return a.kind !== 'care_event' || b.kind !== 'care_event' || a.op === b.op;
  }

  private replace(id: string, item: QueueItem, patch: Partial<QueueBase>) {
    this.list = this.list.map((i) =>
      i.id === id &&
      i.kind === item.kind &&
      this.sameOp(i, item) &&
      PENDING.concat('failed').includes(i.status)
        ? ({ ...i, ...patch } as QueueItem)
        : i,
    );
  }

  private async persist() {
    await this.deps.save(this.list);
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}
