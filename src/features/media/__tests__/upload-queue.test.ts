import {
  backoffMs,
  classifyUploadError,
  MAX_ATTEMPTS,
  UploadQueue,
  type NewQueueItem,
  type QueueDeps,
  type QueueItem,
} from '../upload-queue';

// A fake world: persisted storage, network, an uploader and a clock we control.
function setup(initial: QueueItem[] = []) {
  let stored: QueueItem[] = JSON.parse(JSON.stringify(initial));
  let online = true;
  let clock = new Date('2026-11-10T16:00:00Z');
  const uploads: string[] = [];
  const cleaned: string[] = [];
  let failNext: unknown[] = [];

  const deps: QueueDeps = {
    load: async () => JSON.parse(JSON.stringify(stored)),
    save: async (items) => {
      stored = JSON.parse(JSON.stringify(items));
    },
    isOnline: async () => online,
    upload: async (item) => {
      const error = failNext.shift();
      if (error) throw error;
      uploads.push(item.id);
    },
    cleanup: async (item) => {
      cleaned.push(item.id);
    },
    now: () => clock,
  };

  return {
    deps,
    queue: new UploadQueue(deps),
    uploads,
    cleaned,
    stored: () => stored,
    setOnline: (value: boolean) => {
      online = value;
    },
    advance: (ms: number) => {
      clock = new Date(clock.getTime() + ms);
    },
    failWith: (...errors: unknown[]) => {
      failNext = errors;
    },
  };
}

const photo = (id: string, visitId = 'v1'): NewQueueItem => ({
  kind: 'media',
  id,
  visitId,
  organizationId: 'org',
  mediaType: 'photo',
  fileUri: `file:///queue/${id}.jpg`,
  thumbUri: `file:///queue/${id}-thumb.jpg`,
  width: 1080,
  height: 810,
  durationSeconds: null,
  petIds: ['rex'],
  caption: null,
});

const careEvent = (id: string, value: Record<string, unknown> = {}): NewQueueItem => ({
  kind: 'care_event',
  op: 'insert',
  id,
  visitId: 'v1',
  petId: 'rex',
  type: 'pee',
  value,
  occurredAt: '2026-11-10T16:00:00.000Z',
});

const status = (q: UploadQueue) => q.items().map((i) => `${i.id}:${i.status}`);

const networkError = () => new TypeError('Network request failed');
const serverError = () => Object.assign(new Error('Bad gateway'), { statusCode: '502' });

describe('UploadQueue: success', () => {
  it('uploads right away when online, marks it sent and deletes the local files', async () => {
    const t = setup();
    await t.queue.init();
    await t.queue.enqueue(photo('p1'));

    expect(t.uploads).toEqual(['p1']);
    expect(status(t.queue)).toEqual(['p1:sent']);
    expect(t.cleaned).toEqual(['p1']);
    expect(t.stored()[0]).toMatchObject({ id: 'p1', status: 'sent', attempts: 1 });
  });

  it('uploads in the order things were captured', async () => {
    const t = setup();
    await t.queue.init();
    t.setOnline(false);
    await t.queue.enqueue(photo('p1'));
    await t.queue.enqueue(careEvent('e1'));
    await t.queue.enqueue(photo('p2'));
    t.setOnline(true);
    await t.queue.process();
    expect(t.uploads).toEqual(['p1', 'e1', 'p2']);
  });

  it('notifies subscribers as statuses change', async () => {
    const t = setup();
    await t.queue.init();
    const seen: string[][] = [];
    t.queue.subscribe(() => seen.push(status(t.queue)));
    await t.queue.enqueue(photo('p1'));
    expect(seen).toContainEqual(['p1:uploading']);
    expect(seen.at(-1)).toEqual(['p1:sent']);
  });
});

describe('UploadQueue: offline', () => {
  it('keeps items waiting for signal and uploads nothing', async () => {
    const t = setup();
    await t.queue.init();
    t.setOnline(false);
    await t.queue.enqueue(photo('p1'));
    await t.queue.enqueue(careEvent('e1'));

    expect(t.uploads).toEqual([]);
    expect(status(t.queue)).toEqual(['p1:waiting', 'e1:waiting']);
    expect(t.cleaned).toEqual([]);
  });

  it('sends everything when the signal comes back', async () => {
    const t = setup();
    await t.queue.init();
    t.setOnline(false);
    await t.queue.enqueue(photo('p1'));
    await t.queue.enqueue(photo('p2'));
    t.setOnline(true);
    await t.queue.process();

    expect(t.uploads).toEqual(['p1', 'p2']);
    expect(status(t.queue)).toEqual(['p1:sent', 'p2:sent']);
  });

  it('treats a dropped connection mid-upload as waiting, without using up a retry', async () => {
    const t = setup();
    await t.queue.init();
    t.setOnline(false);
    await t.queue.enqueue(photo('p1'));
    await t.queue.enqueue(photo('p2'));
    t.setOnline(true);
    t.failWith(networkError());
    await t.queue.process();

    expect(status(t.queue)).toEqual(['p1:waiting', 'p2:waiting']);
    expect(t.queue.items()[0].attempts).toBe(0);
    expect(t.uploads).toEqual([]); // stopped instead of trying p2 on a dead network

    await t.queue.process();
    expect(status(t.queue)).toEqual(['p1:sent', 'p2:sent']);
  });

  it('survives an app restart: queued items are still there, and an interrupted upload is retried', async () => {
    const first = setup();
    await first.queue.init();
    first.setOnline(false);
    await first.queue.enqueue(photo('p1'));
    await first.queue.enqueue(photo('p2'));

    // The app was killed while p2 was uploading.
    const saved = first
      .stored()
      .map((i) => (i.id === 'p2' ? { ...i, status: 'uploading' as const } : i));
    const second = setup(saved);
    await second.queue.init();
    expect(status(second.queue)).toEqual(['p1:waiting', 'p2:queued']);

    await second.queue.process();
    expect(second.uploads).toEqual(['p1', 'p2']);
  });
});

describe('UploadQueue: retry', () => {
  it('retries server errors with backoff, then succeeds', async () => {
    const t = setup();
    await t.queue.init();
    t.failWith(serverError(), serverError());
    await t.queue.enqueue(photo('p1'));

    expect(t.queue.items()[0]).toMatchObject({
      status: 'queued',
      attempts: 1,
      lastError: 'Bad gateway',
    });
    expect(t.queue.nextWakeAt()).toEqual(
      new Date(Date.parse('2026-11-10T16:00:00Z') + backoffMs(1)),
    );

    await t.queue.process(); // too early: nothing happens
    expect(t.uploads).toEqual([]);

    t.advance(backoffMs(1));
    await t.queue.process();
    expect(t.queue.items()[0]).toMatchObject({ status: 'queued', attempts: 2 });

    t.advance(backoffMs(2));
    await t.queue.process();
    expect(t.queue.items()[0]).toMatchObject({ status: 'sent', attempts: 3, lastError: null });
  });

  it('gives up after the last attempt and shows it as failed', async () => {
    const t = setup();
    await t.queue.init();
    t.failWith(...Array.from({ length: MAX_ATTEMPTS }, serverError));
    await t.queue.enqueue(photo('p1'));
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      t.advance(backoffMs(attempt));
      await t.queue.process();
    }
    expect(t.queue.items()[0]).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS });
    expect(t.queue.nextWakeAt()).toBeNull();
    expect(t.cleaned).toEqual([]); // the photo is kept for a manual retry
  });

  it('fails at once on errors a retry can’t fix, and retries when asked', async () => {
    const t = setup();
    await t.queue.init();
    t.failWith(Object.assign(new Error('new row violates row-level security'), { code: '42501' }));
    await t.queue.enqueue(photo('p1'));
    expect(t.queue.items()[0]).toMatchObject({ status: 'failed', attempts: 1 });

    await t.queue.retry('p1');
    expect(t.queue.items()[0]).toMatchObject({ status: 'sent' });
    expect(t.uploads).toEqual(['p1']);
  });

  it('counts an item that already reached the server as sent (no duplicates)', async () => {
    const t = setup();
    await t.queue.init();
    t.failWith(Object.assign(new Error('duplicate key value'), { code: '23505' }));
    await t.queue.enqueue(careEvent('e1'));
    expect(status(t.queue)).toEqual(['e1:sent']);
  });

  it('keeps going past a failed item', async () => {
    const t = setup();
    await t.queue.init();
    t.setOnline(false);
    await t.queue.enqueue(photo('p1'));
    await t.queue.enqueue(photo('p2'));
    t.setOnline(true);
    t.failWith(Object.assign(new Error('Payload too large'), { statusCode: '413' }));
    await t.queue.process();
    expect(status(t.queue)).toEqual(['p1:failed', 'p2:sent']);
  });
});

describe('UploadQueue: care events', () => {
  it('folds an update into an insert that hasn’t been sent yet', async () => {
    const t = setup();
    await t.queue.init();
    t.setOnline(false);
    await t.queue.enqueue(careEvent('w1', { started_at: '2026-11-10T16:00:00Z' }));
    await t.queue.updateCareEvent('w1', 'v1', { started_at: '2026-11-10T16:00:00Z', minutes: 20 });

    expect(t.queue.items()).toHaveLength(1);
    expect(t.queue.items()[0]).toMatchObject({ op: 'insert', value: { minutes: 20 } });
  });

  it('queues an update after an insert that was already sent', async () => {
    const t = setup();
    await t.queue.init();
    await t.queue.enqueue(careEvent('w1', { started_at: 'x' }));
    t.setOnline(false);
    await t.queue.updateCareEvent('w1', 'v1', { started_at: 'x', minutes: 20 });
    expect(t.queue.items().map((i) => [i.id, i.kind === 'care_event' && i.op, i.status])).toEqual([
      ['w1', 'insert', 'sent'],
      ['w1', 'update', 'waiting'],
    ]);
  });

  it('cancels an item that hasn’t been sent (undo while offline)', async () => {
    const t = setup();
    await t.queue.init();
    t.setOnline(false);
    await t.queue.enqueue(careEvent('e1'));
    expect(await t.queue.cancel('e1')).toBe(true);
    expect(t.queue.items()).toEqual([]);
    expect(t.cleaned).toEqual(['e1']);

    t.setOnline(true);
    await t.queue.enqueue(careEvent('e2'));
    expect(await t.queue.cancel('e2')).toBe(false); // already sent: delete it on the server instead
  });

  it('lists what is still pending for a visit', async () => {
    const t = setup();
    await t.queue.init();
    t.setOnline(false);
    await t.queue.enqueue(careEvent('e1'));
    await t.queue.enqueue(photo('p9', 'v2'));
    expect(t.queue.pendingFor('v1').map((i) => i.id)).toEqual(['e1']);
  });
});

describe('UploadQueue: housekeeping', () => {
  it('forgets sent items after a day', async () => {
    const t = setup();
    await t.queue.init();
    await t.queue.enqueue(photo('p1'));
    t.setOnline(false);
    await t.queue.enqueue(photo('p2'));
    t.advance(25 * 3_600_000);
    await t.queue.pruneSent();
    expect(status(t.queue)).toEqual(['p2:waiting']);
  });

  it('runs one upload loop at a time', async () => {
    const t = setup();
    await t.queue.init();
    t.setOnline(false);
    await t.queue.enqueue(photo('p1'));
    t.setOnline(true);
    await Promise.all([t.queue.process(), t.queue.process(), t.queue.process()]);
    expect(t.uploads).toEqual(['p1']);
  });
});

describe('classifyUploadError', () => {
  it('sorts errors into offline, duplicate, retry and permanent', () => {
    expect(classifyUploadError(new TypeError('Network request failed'))).toBe('offline');
    expect(classifyUploadError(new Error('Failed to fetch'))).toBe('offline');
    expect(classifyUploadError({ code: '23505', message: 'duplicate key' })).toBe('duplicate');
    expect(classifyUploadError({ statusCode: '409', message: 'The resource already exists' })).toBe(
      'duplicate',
    );
    expect(classifyUploadError({ statusCode: '503', message: 'unavailable' })).toBe('retry');
    expect(classifyUploadError({ status: 401, message: 'JWT expired' })).toBe('retry');
    expect(classifyUploadError({ statusCode: '429', message: 'slow down' })).toBe('retry');
    expect(classifyUploadError({ code: '42501', message: 'RLS' })).toBe('permanent');
    expect(classifyUploadError({ statusCode: '413', message: 'too large' })).toBe('permanent');
    expect(classifyUploadError(new Error('something odd'))).toBe('retry');
  });
});

describe('backoffMs', () => {
  it('doubles from 30 seconds up to 10 minutes', () => {
    expect([1, 2, 3, 4, 5, 10].map(backoffMs)).toEqual([
      30_000, 60_000, 120_000, 240_000, 480_000, 600_000,
    ]);
  });
});
