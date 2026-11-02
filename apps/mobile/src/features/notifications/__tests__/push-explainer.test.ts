import { ASK_AGAIN_AFTER_MS, pushExplanation, shouldExplainPush } from '../push-explainer';

describe('pushExplanation', () => {
  it('explains what each role gets, in plain words', () => {
    expect(pushExplanation('owner').body).toMatch(/arrives/);
    expect(pushExplanation('sitter').body).toMatch(/reminders/);
    expect(pushExplanation('admin').body).toMatch(/late check-ins/);
  });
});

describe('shouldExplainPush', () => {
  const now = Date.parse('2026-11-02T12:00:00Z');

  it('explains before the first system prompt', () => {
    expect(
      shouldExplainPush({ status: 'undetermined', canAskAgain: true, declinedAt: null, now }),
    ).toBe(true);
  });

  it('never explains once the person has answered the system prompt', () => {
    expect(shouldExplainPush({ status: 'granted', canAskAgain: true, declinedAt: null, now })).toBe(
      false,
    );
    expect(shouldExplainPush({ status: 'denied', canAskAgain: false, declinedAt: null, now })).toBe(
      false,
    );
  });

  it('waits a week after "Not now"', () => {
    const base = { status: 'undetermined' as const, canAskAgain: true, now };
    expect(shouldExplainPush({ ...base, declinedAt: now - ASK_AGAIN_AFTER_MS + 1 })).toBe(false);
    expect(shouldExplainPush({ ...base, declinedAt: now - ASK_AGAIN_AFTER_MS })).toBe(true);
  });
});
