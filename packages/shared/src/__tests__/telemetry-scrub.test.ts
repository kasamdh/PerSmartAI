import {
  FILTERED,
  redactText,
  scrubBreadcrumb,
  scrubEvent,
  scrubUrl,
  scrubValue,
} from '../telemetry-scrub.ts';

describe('redactText', () => {
  it('removes emails, phone numbers and tokens from error messages', () => {
    expect(redactText('Key (email)=(ana.lee@example.com) already exists')).toBe(
      `Key (email)=(${FILTERED}) already exists`,
    );
    expect(redactText('Call (555) 123-4567 or +1 555 987 6543')).toBe(
      `Call ${FILTERED} or ${FILTERED}`,
    );
    expect(redactText('Bearer eyJhbGc.eyJzdWIi.sig-_123')).toBe(`Bearer ${FILTERED}`);
  });

  it('leaves ids, times and counts alone', () => {
    const text = 'Visit 5e000000-0000-4000-8000-000000000101 at 2026-11-02T14:00:00Z failed (409)';
    expect(redactText(text)).toBe(text);
  });
});

describe('scrubValue', () => {
  it('filters addresses, messages, notes and access codes at any depth', () => {
    const value = scrubValue({
      household: { id: 'h1', address_line1: '12 Oak St', lat: 40.1, name: 'Lee home' },
      messages: [{ body: 'Gate code is 4321' }],
      access: { wifi_password: 'hunter2', entry_instructions: 'Key under mat' },
      visit: { id: 'v1', status: 'arrived', status_line: 'At the park with Max' },
      count: 3,
    });
    expect(value).toEqual({
      household: { id: 'h1', address_line1: FILTERED, lat: FILTERED, name: FILTERED },
      messages: FILTERED,
      access: { wifi_password: FILTERED, entry_instructions: FILTERED },
      visit: { id: 'v1', status: 'arrived', status_line: FILTERED },
      count: 3,
    });
  });
});

describe('scrubUrl', () => {
  it('drops query strings (PostgREST filters and searches)', () => {
    expect(
      scrubUrl('https://x.supabase.co/rest/v1/households?address_line1=ilike.%25oak%25#top'),
    ).toBe('https://x.supabase.co/rest/v1/households');
  });
});

describe('scrubBreadcrumb', () => {
  it('drops console breadcrumbs entirely', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'owner 12 Oak St' })).toBeNull();
  });

  it('keeps method and status but not bodies or query strings', () => {
    expect(
      scrubBreadcrumb({
        category: 'fetch',
        data: {
          method: 'POST',
          url: 'https://x.supabase.co/rest/v1/messages?select=*',
          status_code: 201,
          body: '{"body":"I left the key with the neighbor"}',
        },
      }),
    ).toEqual({
      category: 'fetch',
      data: { method: 'POST', url: 'https://x.supabase.co/rest/v1/messages', status_code: 201 },
    });
  });
});

describe('scrubEvent', () => {
  const event = {
    event_id: 'e1',
    message: 'Failed for ana@example.com',
    user: { id: 'u1', email: 'ana@example.com', ip_address: '1.2.3.4', username: 'Ana' },
    request: {
      url: 'https://admin.example.com/clients?q=oak',
      method: 'GET',
      data: { address_line1: '12 Oak St' },
      cookies: { 'sb-auth-token': 'secret' },
      headers: { Authorization: 'Bearer x' },
    },
    exception: { values: [{ type: 'Error', value: 'duplicate key (phone)=(555-123-4567)' }] },
    extra: { household: { address_line1: '12 Oak St', id: 'h1' } },
    breadcrumbs: [
      { category: 'console', message: 'debug 12 Oak St' },
      { category: 'navigation', data: { from: '/clients?q=oak', to: '/clients/h1' } },
    ],
  };

  it('keeps what is needed to debug and nothing personal', () => {
    expect(scrubEvent(event)).toEqual({
      event_id: 'e1',
      message: `Failed for ${FILTERED}`,
      user: { id: 'u1' },
      request: { url: 'https://admin.example.com/clients', method: 'GET' },
      exception: { values: [{ type: 'Error', value: `duplicate key (phone)=(${FILTERED})` }] },
      extra: { household: { address_line1: FILTERED, id: 'h1' } },
      breadcrumbs: [{ category: 'navigation', data: { from: '/clients', to: '/clients/h1' } }],
    });
  });

  it('never leaves an address, message text, email or phone anywhere in the payload', () => {
    const json = JSON.stringify(scrubEvent(event));
    for (const secret of ['Oak St', 'ana@example.com', '555-123-4567', '1.2.3.4', 'secret']) {
      expect(json).not.toContain(secret);
    }
  });
});
