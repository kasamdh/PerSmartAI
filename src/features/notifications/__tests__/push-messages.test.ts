import { buildPushMessage, joinNames } from '../../../../supabase/functions/_shared/push-messages';

const ctx = { sitterName: 'Monika Pokhrel', petNames: ['Biscuit', 'Mochi'] };

describe('joinNames', () => {
  it('reads naturally for any number of pets', () => {
    expect(joinNames([])).toBe('your pets');
    expect(joinNames(['Rex'])).toBe('Rex');
    expect(joinNames(['Biscuit', 'Mochi'])).toBe('Biscuit & Mochi');
    expect(joinNames(['Biscuit', 'Mochi', 'Rex'])).toBe('Biscuit, Mochi & Rex');
  });
});

describe('buildPushMessage', () => {
  const status = (s: string) =>
    buildPushMessage({ type: 'visit_status', visit_id: 'v1', status: s }, ctx);

  it('announces the sitter heading over, checking in, and finishing', () => {
    expect(status('on_the_way')?.title).toBe('Monika is on the way');
    expect(status('in_progress')).toEqual({
      title: 'Monika checked in',
      body: 'Biscuit & Mochi are in good hands.',
      data: { visitId: 'v1', type: 'visit_status' },
    });
    expect(status('completed')?.body).toBe('Monika checked out. See how Biscuit & Mochi did.');
  });

  it('uses singular grammar for one pet', () => {
    const msg = buildPushMessage(
      { type: 'visit_status', visit_id: 'v1', status: 'in_progress' },
      { sitterName: 'Sky', petNames: ['Rex'] },
    );
    expect(msg?.body).toBe('Rex is in good hands.');
  });

  it('stays quiet for statuses owners do not need pinged about', () => {
    expect(status('scheduled')).toBeNull();
    expect(status('arrived')).toBeNull();
    expect(status('missed')).toBeNull();
  });

  it('announces photos and incidents, linking to the visit', () => {
    const photo = buildPushMessage({ type: 'visit_photo', visit_id: 'v2', media_id: 'm1' }, ctx);
    expect(photo).toMatchObject({ title: 'New photo of Biscuit & Mochi', data: { visitId: 'v2' } });

    const incident = buildPushMessage(
      { type: 'incident', visit_id: 'v3', incident_id: 'i1' },
      { sitterName: null, petNames: [] },
    );
    expect(incident?.body).toBe(
      'Your sitter reported an incident with your pets. Tap for details.',
    );
  });
});
