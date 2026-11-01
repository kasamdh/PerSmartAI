import {
  buildMessageAlert,
  decideMessageAlert,
  MESSAGE_ALERT_GAP_MS,
  messageAlertsByRecipient,
} from '../chat-alerts.ts';

const now = new Date('2026-11-10T16:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('decideMessageAlert', () => {
  it('sends the first message right away', () => {
    expect(decideMessageAlert({ unsent: [ago(1000)], lastAlertAt: null, now })).toEqual({
      send: true,
      coveredUntil: ago(1000),
    });
  });

  it('batches messages that arrive within a minute of the last alert', () => {
    expect(
      decideMessageAlert({ unsent: [ago(5_000), ago(2_000)], lastAlertAt: ago(20_000), now }),
    ).toEqual({ send: false, retryAt: new Date(ago(20_000).getTime() + MESSAGE_ALERT_GAP_MS) });
  });

  it('sends the batch once the minute has passed', () => {
    expect(
      decideMessageAlert({
        unsent: [ago(50_000), ago(40_000), ago(30_000)],
        lastAlertAt: ago(61_000),
        now,
      }),
    ).toEqual({ send: true, coveredUntil: ago(30_000) });
  });

  it('has nothing to send without new messages', () => {
    expect(decideMessageAlert({ unsent: [], lastAlertAt: null, now })).toEqual({
      send: false,
      retryAt: null,
    });
  });
});

describe('messageAlertsByRecipient', () => {
  const messages = [
    {
      sender_id: 'owner',
      sender_name: 'Rudra Dhakal',
      body: 'Is Max ok?',
      has_photo: false,
      created_at: ago(30_000).toISOString(),
    },
    {
      sender_id: 'sitter',
      sender_name: 'Monika Pokhrel',
      body: null,
      has_photo: true,
      created_at: ago(20_000).toISOString(),
    },
    {
      sender_id: 'owner',
      sender_name: 'Rudra Dhakal',
      body: 'Thanks!',
      has_photo: false,
      created_at: ago(10_000).toISOString(),
    },
  ];

  it('counts only others’ messages, per participant', () => {
    expect(messageAlertsByRecipient(messages, ['owner', 'sitter', 'admin'], new Map())).toEqual([
      {
        recipientId: 'owner',
        count: 1,
        senderNames: ['Monika'],
        last: { body: null, hasPhoto: true },
      },
      {
        recipientId: 'sitter',
        count: 2,
        senderNames: ['Rudra'],
        last: { body: 'Thanks!', hasPhoto: false },
      },
      {
        recipientId: 'admin',
        count: 3,
        senderNames: ['Rudra', 'Monika'],
        last: { body: 'Thanks!', hasPhoto: false },
      },
    ]);
  });

  it('skips people who already read them (they have the chat open)', () => {
    const reads = new Map([
      ['admin', ago(5_000)],
      ['sitter', ago(25_000)],
    ]);
    const alerts = messageAlertsByRecipient(messages, ['sitter', 'admin'], reads);
    expect(alerts.map((a) => [a.recipientId, a.count])).toEqual([['sitter', 1]]);
  });
});

describe('buildMessageAlert', () => {
  it('shows one message with its sender and home', () => {
    expect(
      buildMessageAlert(
        {
          recipientId: 'x',
          count: 1,
          senderNames: ['Monika'],
          last: { body: 'Max loved the walk', hasPhoto: false },
        },
        { householdId: 'h1', householdName: 'Lee home' },
      ),
    ).toEqual({
      kind: 'messages',
      title: 'Monika · Lee home',
      body: 'Max loved the walk',
      data: { type: 'message', householdId: 'h1' },
    });
  });

  it('says "Photo" for a photo without text, and trims long messages', () => {
    const photo = buildMessageAlert(
      { recipientId: 'x', count: 1, senderNames: ['Monika'], last: { body: null, hasPhoto: true } },
      { householdId: 'h1', householdName: 'Lee home' },
    );
    expect(photo.body).toBe('📷 Photo');
    const long = buildMessageAlert(
      {
        recipientId: 'x',
        count: 1,
        senderNames: ['Monika'],
        last: { body: 'a'.repeat(300), hasPhoto: false },
      },
      { householdId: 'h1', householdName: 'Lee home' },
    );
    expect(long.body.length).toBeLessThanOrEqual(140);
    expect(long.body.endsWith('…')).toBe(true);
  });

  it('batches several into one alert', () => {
    expect(
      buildMessageAlert(
        {
          recipientId: 'x',
          count: 3,
          senderNames: ['Rudra', 'Monika'],
          last: { body: 'Thanks!', hasPhoto: false },
        },
        { householdId: 'h1', householdName: 'Lee home' },
      ),
    ).toMatchObject({ title: 'Lee home: 3 new messages', body: 'Rudra & Monika: Thanks!' });
  });
});
