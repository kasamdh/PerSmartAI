import { homeHeadline, joinPetNames, visitWhen } from '../owner-home';

const now = new Date('2026-11-02T10:00:00');
const visit = (status: string, start: string, end: string, sitter = 'Monika Pokhrel') => ({
  status,
  scheduled_start: new Date(start).toISOString(),
  scheduled_end: new Date(end).toISOString(),
  sitter: { full_name: sitter },
  booking: { booking_pets: [{ pet: { name: 'Biscuit' } }, { pet: { name: 'Mochi' } }] },
});

describe('joinPetNames', () => {
  it('reads naturally for one, two or more pets', () => {
    expect(joinPetNames(['Max'])).toBe('Max');
    expect(joinPetNames(['Biscuit', 'Mochi'])).toBe('Biscuit and Mochi');
    expect(joinPetNames(['Biscuit', 'Mochi', 'Rex'])).toBe('Biscuit, Mochi and Rex');
    expect(joinPetNames([])).toBe('your pets');
  });
});

describe('homeHeadline', () => {
  it('says what is happening right now, by first name', () => {
    const live = visit('arrived', '2026-11-02T09:45:00', '2026-11-02T10:15:00');
    expect(homeHeadline({ active: [live], upcoming: [] }, now)).toBe(
      'Monika is with Biscuit and Mochi now',
    );
    const coming = visit('on_the_way', '2026-11-02T10:30:00', '2026-11-02T11:00:00');
    expect(homeHeadline({ active: [coming], upcoming: [] }, now)).toBe(
      'Monika is on the way to Biscuit and Mochi',
    );
  });

  it('otherwise shows the next visit, or that nothing is booked', () => {
    const next = visit('scheduled', '2026-11-03T12:00:00', '2026-11-03T12:30:00');
    expect(homeHeadline({ active: [], upcoming: [next] }, now)).toMatch(/^Next visit: Tomorrow /);
    expect(homeHeadline({ active: [], upcoming: [] }, now)).toBe('No visits booked yet');
  });
});

describe('visitWhen', () => {
  it('gives the day, the time range and the sitter', () => {
    const next = visit('scheduled', '2026-11-03T12:00:00', '2026-11-03T12:30:00');
    expect(visitWhen(next, now)).toMatch(/^Tomorrow, 12:00.*12:30.* · Monika$/);
  });
});
