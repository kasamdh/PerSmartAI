import {
  checkVideoLength,
  galleryRows,
  groupByVisitDate,
  mediaPaths,
  mergePendingCareEvents,
  queueStatusLabel,
  tilesPerRow,
  uuidv4,
  videoContentType,
} from '../media-logic';

describe('mediaPaths', () => {
  it('follows {organization_id}/{visit_id}/{uuid} with a thumbnail next to it', () => {
    expect(mediaPaths('org', 'visit', 'abc', 'photo')).toEqual({
      storagePath: 'org/visit/abc.jpg',
      thumbPath: 'org/visit/abc-thumb.jpg',
      contentType: 'image/jpeg',
    });
    expect(mediaPaths('org', 'visit', 'abc', 'video', 'file:///clip.MOV')).toEqual({
      storagePath: 'org/visit/abc.mov',
      thumbPath: 'org/visit/abc-thumb.jpg',
      contentType: 'video/quicktime',
    });
    expect(mediaPaths('org', 'visit', 'abc', 'video', 'file:///clip.mp4').storagePath).toBe(
      'org/visit/abc.mp4',
    );
  });
});

describe('videoContentType', () => {
  it('knows mp4 and mov, defaulting to mp4', () => {
    expect(videoContentType('a.mp4')).toEqual({ ext: 'mp4', type: 'video/mp4' });
    expect(videoContentType('a.mov')).toEqual({ ext: 'mov', type: 'video/quicktime' });
    expect(videoContentType('content://media/123')).toEqual({ ext: 'mp4', type: 'video/mp4' });
  });
});

describe('checkVideoLength', () => {
  it('allows up to 15 seconds', () => {
    expect(checkVideoLength(14_900)).toEqual({ ok: true, seconds: 14.9 });
    expect(checkVideoLength(15_000)).toEqual({ ok: true, seconds: 15 });
  });

  it('rejects longer clips and unknown lengths', () => {
    expect(checkVideoLength(15_600)).toEqual({
      ok: false,
      error: 'Videos can be up to 15 seconds. This one is 16 seconds.',
    });
    expect(checkVideoLength(null)).toEqual({
      ok: false,
      error: 'Couldn’t read this video’s length.',
    });
  });
});

describe('uuidv4', () => {
  it('makes distinct version 4 UUIDs', () => {
    const ids = Array.from({ length: 200 }, () => uuidv4());
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('mergePendingCareEvents', () => {
  const server = [
    { id: 'a', type: 'pee', value: {}, occurred_at: '2026-11-10T16:05:00Z', pet_id: 'rex' },
    {
      id: 'w',
      type: 'walk',
      value: { started_at: 'x' },
      occurred_at: '2026-11-10T16:01:00Z',
      pet_id: 'rex',
    },
  ];

  it('adds unsent events, applies unsent updates, newest first', () => {
    const merged = mergePendingCareEvents(server, [
      {
        kind: 'care_event',
        op: 'insert',
        id: 'b',
        type: 'fed',
        value: { amount_eaten: 'all' },
        occurredAt: '2026-11-10T16:10:00Z',
        petId: 'rex',
        status: 'waiting',
      },
      {
        kind: 'care_event',
        op: 'update',
        id: 'w',
        type: 'walk',
        value: { started_at: 'x', minutes: 12 },
        occurredAt: '2026-11-10T16:01:00Z',
        petId: 'rex',
        status: 'waiting',
      },
    ]);
    expect(merged.map((e) => [e.id, e.pending])).toEqual([
      ['b', true],
      ['a', false],
      ['w', true],
    ]);
    expect(merged.find((e) => e.id === 'w')?.value).toEqual({ started_at: 'x', minutes: 12 });
  });

  it('does not duplicate an event the server already has', () => {
    const merged = mergePendingCareEvents(server, [
      {
        kind: 'care_event',
        op: 'insert',
        id: 'a',
        type: 'pee',
        value: {},
        occurredAt: '2026-11-10T16:05:00Z',
        petId: 'rex',
        status: 'uploading',
      },
    ]);
    expect(merged.map((e) => e.id)).toEqual(['a', 'w']);
  });
});

describe('groupByVisitDate', () => {
  it('groups photos by the day of their visit, newest day first', () => {
    const at = (d: number, h: number) => new Date(2026, 10, d, h).toISOString();
    const groups = groupByVisitDate([
      { id: '1', visitStart: at(3, 9), created_at: at(3, 9) },
      { id: '2', visitStart: at(5, 9), created_at: at(5, 10) },
      { id: '3', visitStart: at(3, 9), created_at: at(3, 11) },
    ]);
    expect(groups.map((g) => [g.date, g.items.map((i) => i.id)])).toEqual([
      ['2026-11-05', ['2']],
      ['2026-11-03', ['3', '1']],
    ]);
  });
});

describe('queueStatusLabel', () => {
  it('reads plainly', () => {
    expect(queueStatusLabel('uploading')).toBe('Uploading…');
    expect(queueStatusLabel('queued')).toBe('Uploading…');
    expect(queueStatusLabel('sent')).toBe('Sent');
    expect(queueStatusLabel('waiting')).toBe('Waiting for signal');
    expect(queueStatusLabel('failed')).toBe('Failed');
  });
});

describe('galleryRows', () => {
  const groups = [
    { date: '2026-11-03', items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] },
    { date: '2026-11-01', items: [{ id: 'e' }] },
  ];

  it('makes a header per day and rows of tiles, numbering items across the gallery', () => {
    expect(
      galleryRows(groups, 3).map((r) =>
        r.kind === 'header' ? r.key : r.tiles.map((t) => `${t.item.id}${t.index}`).join(' '),
      ),
    ).toEqual(['h-2026-11-03', 'a0 b1 c2', 'd3', 'h-2026-11-01', 'e4']);
  });

  it('fits tiles to the screen width', () => {
    expect(tilesPerRow(390)).toBe(3);
    expect(tilesPerRow(430)).toBe(3);
    expect(tilesPerRow(440)).toBe(4);
    expect(tilesPerRow(200)).toBe(1);
  });
});
