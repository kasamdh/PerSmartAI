import {
  SchedulingError,
  invokeScheduleAction,
  type FunctionsClient,
} from '../schedule-actions.ts';

const client = (result: { data: unknown; error: unknown }) => {
  const invoke = jest.fn().mockResolvedValue(result);
  return { client: { functions: { invoke } } as FunctionsClient, invoke };
};

describe('invokeScheduleAction', () => {
  it('posts the action and its arguments', async () => {
    const { client: c, invoke } = client({ data: { ok: true, problems: [] }, error: null });
    await expect(
      invokeScheduleAction(c, 'update_visit', {
        visit_id: 'v1',
        date: '2026-11-03',
        preview: true,
      }),
    ).resolves.toEqual({ ok: true, problems: [] });
    expect(invoke).toHaveBeenCalledWith('schedule-booking', {
      method: 'POST',
      body: { action: 'update_visit', visit_id: 'v1', date: '2026-11-03', preview: true },
    });
  });

  it("turns the function's 409 body into a SchedulingError with reasons", async () => {
    const problems = [
      { local_date: '2026-11-03', start: 'a', end: 'b', blocking: true, reasons: ['Overlaps'] },
    ];
    const response = new Response(JSON.stringify({ error: 'Blocked', problems }), { status: 409 });
    const { client: c } = client({ data: null, error: { message: 'x', context: response } });
    const error = await invokeScheduleAction(c, 'confirm', {
      booking_id: 'b',
      sitter_id: 's',
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SchedulingError);
    expect((error as SchedulingError).isConflict).toBe(true);
    expect((error as SchedulingError).problems).toEqual(problems);
  });

  it('rethrows network errors as they are', async () => {
    const failure = new Error('offline');
    const { client: c } = client({ data: null, error: failure });
    await expect(
      invokeScheduleAction(c, 'decide_request', { request_id: 'r', approve: true }),
    ).rejects.toBe(failure);
  });
});
