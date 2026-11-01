import { daySeparators, nextCursor, PAGE_SIZE, readReceipt } from '../chat-logic';

describe('nextCursor', () => {
  const msg = (i: number) => ({
    id: `m${i}`,
    created_at: new Date(2026, 10, 10, 12, i).toISOString(),
  });

  it('continues from the oldest message of a full page', () => {
    const page = Array.from({ length: PAGE_SIZE }, (_, i) => msg(PAGE_SIZE - i));
    expect(nextCursor(page)).toEqual({ created_at: page.at(-1)!.created_at, id: page.at(-1)!.id });
  });

  it('stops after a short page', () => {
    expect(nextCursor([msg(2), msg(1)])).toBeUndefined();
    expect(nextCursor([])).toBeUndefined();
  });

  it('loads pages of 30', () => {
    expect(PAGE_SIZE).toBe(30);
  });
});

describe('readReceipt', () => {
  const sent = '2026-11-10T16:00:00Z';
  const reads = [
    { user_id: 'me', read_at: '2026-11-10T17:00:00Z', name: 'Me Myself' },
    { user_id: 'owner', read_at: '2026-11-10T16:05:00Z', name: 'Rudra Dhakal' },
    { user_id: 'admin', read_at: '2026-11-10T15:00:00Z', name: 'Alex Admin' },
  ];

  it('names who has read my message', () => {
    expect(readReceipt({ sender_id: 'me', created_at: sent }, reads, 'me')).toBe('Read by Rudra');
  });

  it('counts when several have read it', () => {
    const more = [
      ...reads,
      { user_id: 'sitter', read_at: '2026-11-10T16:30:00Z', name: 'Monika P' },
    ];
    expect(readReceipt({ sender_id: 'me', created_at: sent }, more, 'me')).toBe(
      'Read by Rudra & Monika',
    );
    const many = [...more, { user_id: 'x', read_at: '2026-11-10T16:30:00Z', name: 'Xi' }];
    expect(readReceipt({ sender_id: 'me', created_at: sent }, many, 'me')).toBe('Read by 3 people');
  });

  it('says Sent until someone reads it, and nothing for others’ messages', () => {
    expect(readReceipt({ sender_id: 'me', created_at: '2026-11-10T16:10:00Z' }, reads, 'me')).toBe(
      'Sent',
    );
    expect(readReceipt({ sender_id: 'owner', created_at: sent }, reads, 'me')).toBeNull();
  });
});

describe('daySeparators', () => {
  it('marks the first message of each local day (list is newest first)', () => {
    const at = (d: number, h: number) => new Date(2026, 10, d, h).toISOString();
    const messages = [
      { id: 'c', created_at: at(11, 9) },
      { id: 'b', created_at: at(10, 18) },
      { id: 'a', created_at: at(10, 9) },
    ];
    expect([...daySeparators(messages)]).toEqual([
      ['c', '2026-11-11'],
      ['a', '2026-11-10'],
    ]);
  });
});
