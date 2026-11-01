import { SchedulingError, schedulingErrorText, toSchedulingError } from '../api';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('toSchedulingError', () => {
  it('keeps the message and per-visit problems of a refused change', () => {
    const problems = [
      {
        local_date: '2026-11-10',
        start: '2026-11-10T17:00:00.000Z',
        end: '2026-11-10T17:30:00.000Z',
        blocking: true,
        reasons: ['Overlaps Walk at Lee home (Tue, Nov 10, 11:50 AM–12:20 PM)'],
      },
    ];
    const error = toSchedulingError(409, { error: "The sitter can't take one visit", problems });
    expect(error).toBeInstanceOf(SchedulingError);
    expect(error.message).toBe("The sitter can't take one visit");
    expect(error.isConflict).toBe(true);
    expect(error.problems).toEqual(problems);
  });

  it('falls back for bodies that are not the expected shape', () => {
    const error = toSchedulingError(500, 'oops');
    expect(error.message).toBe('Something went wrong');
    expect(error.problems).toEqual([]);
    expect(error.isConflict).toBe(false);
  });
});

describe('schedulingErrorText', () => {
  const problem = (reason: string, blocking = true) => ({
    local_date: '2026-11-10',
    start: '',
    end: '',
    blocking,
    reasons: [reason],
  });

  it('lists the blocking reasons, capped', () => {
    const error = new SchedulingError("The sitter can't take 4 visits", 409, [
      problem('A'),
      problem('Warning only', false),
      problem('B'),
      problem('C'),
      problem('D'),
    ]);
    expect(schedulingErrorText(error)).toBe(
      "The sitter can't take 4 visits:\n• A\n• B\n• C\n…and 1 more",
    );
  });

  it('uses the plain message otherwise', () => {
    expect(schedulingErrorText(new Error('Network down'))).toBe('Network down');
    expect(schedulingErrorText(new SchedulingError('Pick a time in the future', 400))).toBe(
      'Pick a time in the future',
    );
  });
});
