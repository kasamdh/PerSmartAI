import { ownerStatusText, partitionOwnerVisits, RECENT_LIMIT } from '../owner-visits';
import type { VisitStatus } from '@/features/visits/visit-actions';

const now = new Date('2026-10-31T15:00:00Z');

function visit(id: string, status: VisitStatus, startIso: string, minutes = 30) {
  const start = new Date(startIso);
  return {
    id,
    status,
    scheduled_start: start.toISOString(),
    scheduled_end: new Date(start.getTime() + minutes * 60_000).toISOString(),
    check_in_at: null as string | null,
    check_out_at: null as string | null,
  };
}

describe('partitionOwnerVisits', () => {
  it('puts in-progress visits under now, future under upcoming, past under recent', () => {
    const { active, upcoming, recent } = partitionOwnerVisits(
      [
        visit('past', 'completed', '2026-10-30T15:00:00Z'),
        visit('now', 'in_progress', '2026-10-31T14:50:00Z'),
        visit('later', 'scheduled', '2026-11-01T15:00:00Z'),
        visit('soon', 'scheduled', '2026-10-31T18:00:00Z'),
        visit('way', 'on_the_way', '2026-10-31T15:10:00Z'),
      ],
      now,
    );

    expect(active.map((v) => v.id)).toEqual(['now', 'way']);
    expect(upcoming.map((v) => v.id)).toEqual(['soon', 'later']);
    expect(recent.map((v) => v.id)).toEqual(['past']);
  });

  it('treats a scheduled visit whose window has passed as recent, not upcoming', () => {
    const { upcoming, recent } = partitionOwnerVisits(
      [visit('stale', 'scheduled', '2026-10-31T10:00:00Z')],
      now,
    );
    expect(upcoming).toEqual([]);
    expect(recent.map((v) => v.id)).toEqual(['stale']);
  });

  it('drops cancelled visits and caps recent history, newest first', () => {
    const past = Array.from({ length: RECENT_LIMIT + 3 }, (_, i) =>
      visit(`p${i}`, 'completed', new Date(now.getTime() - (i + 1) * 86_400_000).toISOString()),
    );
    const { recent } = partitionOwnerVisits(
      [...past, visit('x', 'cancelled', '2026-10-31T09:00:00Z')],
      now,
    );

    expect(recent).toHaveLength(RECENT_LIMIT);
    expect(recent[0].id).toBe('p0');
    expect(recent.map((v) => v.id)).not.toContain('x');
  });
});

describe('ownerStatusText', () => {
  const base = visit('v', 'scheduled', '2026-10-31T18:00:00Z');

  it('tells the owner what is happening right now', () => {
    expect(ownerStatusText({ ...base, status: 'on_the_way' }, 'Monika', now)).toBe(
      'Monika is on the way',
    );
    expect(
      ownerStatusText(
        { ...base, status: 'in_progress', check_in_at: '2026-10-31T14:05:00Z' },
        'Monika',
        now,
      ),
    ).toMatch(/^Monika checked in at /);
    expect(ownerStatusText({ ...base, status: 'arrived' }, 'Monika', now)).toBe(
      'Monika is with your pets',
    );
  });

  it('falls back to "Your sitter" when none is assigned', () => {
    expect(ownerStatusText({ ...base, status: 'on_the_way' }, null, now)).toBe(
      'Your sitter is on the way',
    );
  });

  it('describes finished and missed visits', () => {
    expect(
      ownerStatusText(
        { ...base, status: 'completed', check_out_at: '2026-10-31T14:40:00Z' },
        'Monika',
        now,
      ),
    ).toMatch(/^Visit finished at /);
    expect(ownerStatusText({ ...base, status: 'missed' }, 'Monika', now)).toBe('Visit was missed');
  });

  it('shows who and when for scheduled visits', () => {
    expect(ownerStatusText(base, 'Monika', now)).toMatch(/^Monika · (Today|Tomorrow) /);
  });
});
