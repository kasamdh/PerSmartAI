import { logoProblem, orgSettingsSchema, toOrganizationUpdate } from '../org-settings-schema.ts';

const valid = {
  name: ' Happy Paws ',
  timeZone: 'America/New_York',
  travelBufferMinutes: '15',
  cancellationCutoffHours: '24',
  mediaRetentionMonths: '',
  primaryColor: '#0e7c66',
  accentColor: '',
};

describe('orgSettingsSchema', () => {
  it('parses the form into database values', () => {
    const values = orgSettingsSchema.parse(valid);
    expect(toOrganizationUpdate(values)).toEqual({
      name: 'Happy Paws',
      timezone: 'America/New_York',
      travel_buffer_minutes: 15,
      cancellation_cutoff_hours: 24,
      media_retention_months: null,
      primary_color: '#0E7C66',
      accent_color: null,
    });
  });

  it('rejects values the database would refuse', () => {
    const errors = (input: object) =>
      orgSettingsSchema
        .safeParse({ ...valid, ...input })
        .error?.issues.map((i) => i.path.join('.'));
    expect(errors({ timeZone: 'Mars/Olympus' })).toEqual(['timeZone']);
    expect(errors({ travelBufferMinutes: '300' })).toEqual(['travelBufferMinutes']);
    expect(errors({ cancellationCutoffHours: '-1' })).toEqual(['cancellationCutoffHours']);
    expect(errors({ mediaRetentionMonths: '0' })).toEqual(['mediaRetentionMonths']);
    expect(errors({ primaryColor: 'teal' })).toEqual(['primaryColor']);
    expect(errors({ name: ' ' })).toEqual(['name']);
  });
});

describe('logoProblem', () => {
  it('accepts small PNG, JPEG and WebP images', () => {
    expect(logoProblem({ type: 'image/png', size: 200_000 })).toBeNull();
    expect(logoProblem({ type: 'image/svg+xml', size: 2_000 })).toMatch(/PNG/);
    expect(logoProblem({ type: 'image/jpeg', size: 3_000_000 })).toMatch(/1 MB/);
  });
});
