import { csvField, decimalHours, payrollCsv, weeklyPayroll } from '../payroll.ts';

const TZ = 'America/New_York';
const sitters = [
  { id: 's1', full_name: 'Ana' },
  { id: 's2', full_name: 'Ben' },
];
const v = (
  sitter: string | null,
  start: string,
  end: string,
  status: string,
  checkIn: string | null = null,
  checkOut: string | null = null,
) => ({
  sitter_id: sitter,
  status,
  scheduled_start: start,
  scheduled_end: end,
  check_in_at: checkIn,
  check_out_at: checkOut,
});

describe('weeklyPayroll', () => {
  const visits = [
    // Completed: 30 scheduled, worked 09:05–09:45 = 40 minutes.
    v(
      's1',
      '2026-11-02T14:00:00Z',
      '2026-11-02T14:30:00Z',
      'completed',
      '2026-11-02T14:05:00Z',
      '2026-11-02T14:45:00Z',
    ),
    // Overnight: 12 hours scheduled, not done yet.
    v('s1', '2026-11-03T23:00:00Z', '2026-11-04T11:00:00Z', 'scheduled'),
    v('s1', '2026-11-05T14:00:00Z', '2026-11-05T14:30:00Z', 'missed'),
    v('s1', '2026-11-06T14:00:00Z', '2026-11-06T14:30:00Z', 'cancelled'),
    // Sunday 23:30 local is Monday in UTC: still this week.
    v('s2', '2026-11-09T04:30:00Z', '2026-11-09T05:00:00Z', 'scheduled'),
    // Monday 00:30 local the next week: not counted.
    v('s2', '2026-11-09T05:30:00Z', '2026-11-09T06:00:00Z', 'scheduled'),
    v(null, '2026-11-02T15:00:00Z', '2026-11-02T15:30:00Z', 'scheduled'),
  ];

  it("counts each sitter's visits and hours for the business-local week", () => {
    const { days, rows } = weeklyPayroll(visits, sitters, '2026-11-04', TZ);
    expect(days[0]).toBe('2026-11-02');
    expect(rows).toEqual([
      {
        sitterId: 's1',
        name: 'Ana',
        scheduledVisits: 2,
        completedVisits: 1,
        missedVisits: 1,
        scheduledMinutes: 30 + 720,
        workedMinutes: 40,
      },
      {
        sitterId: 's2',
        name: 'Ben',
        scheduledVisits: 1,
        completedVisits: 0,
        missedVisits: 0,
        scheduledMinutes: 30,
        workedMinutes: 0,
      },
    ]);
  });

  it('exports a CSV payroll can import', () => {
    const { rows } = weeklyPayroll(visits, sitters, '2026-11-04', TZ);
    expect(payrollCsv(rows, '2026-11-02').split('\r\n')).toEqual([
      'Week starting,Sitter,Visits scheduled,Visits completed,Visits missed,Scheduled hours,Worked hours',
      '2026-11-02,Ana,2,1,1,12.50,0.67',
      '2026-11-02,Ben,1,0,0,0.50,0.00',
      '',
    ]);
  });
});

describe('csvField', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvField('Lee, Ana')).toBe('"Lee, Ana"');
    expect(csvField('Ana "AJ" Lee')).toBe('"Ana ""AJ"" Lee"');
  });

  it("doesn't let a name run as a spreadsheet formula", () => {
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField('+1 555')).toBe("'+1 555");
    expect(csvField(-3)).toBe('-3');
  });
});

it('formats decimal hours', () => {
  expect(decimalHours(90)).toBe('1.50');
  expect(decimalHours(0)).toBe('0.00');
});
