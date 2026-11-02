import { render, screen } from '@testing-library/react-native';

import * as authHooks from '@/features/auth/use-profile';
import * as careHooks from '@/features/care/hooks';

import * as hooks from '../hooks';
import { OwnerVisitScreen } from '../owner-visit-screen';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('../hooks');
jest.mock('@/features/care/hooks');
jest.mock('@/features/auth/use-profile');
jest.mock('@/features/care/photo-grid', () => ({ PhotoGrid: () => null }));

const query = <T,>(data: T) => ({ isPending: false, isError: false, data, refetch: jest.fn() });

const baseVisit = {
  id: 'v1',
  status: 'in_progress',
  scheduled_start: '2026-11-10T16:00:00Z',
  scheduled_end: '2026-11-10T16:30:00Z',
  on_the_way_at: '2026-11-10T15:52:00Z',
  check_in_at: '2026-11-10T16:03:00Z',
  started_at: '2026-11-10T16:04:00Z',
  check_out_at: null,
  summary_note: null,
  status_line: 'Out on a walk with Rex',
  sitter: { full_name: 'Monika Pokhrel', avatar_url: null },
  booking: {
    service_type: 'walk',
    household: { name: 'Home', address_line1: '1 A St' },
    booking_pets: [{ pet: { id: 'rex', name: 'Rex', species: 'dog' } }],
  },
};

const events = [
  {
    id: 'e1',
    type: 'walk',
    value: { started_at: '2026-11-10T16:05:00Z', minutes: 22 },
    occurred_at: '2026-11-10T16:05:00Z',
    created_by: 's',
    pet_id: 'rex',
    pet: { id: 'rex', name: 'Rex' },
  },
  {
    id: 'e2',
    type: 'pee',
    value: {},
    occurred_at: '2026-11-10T16:10:00Z',
    created_by: 's',
    pet_id: 'rex',
    pet: { id: 'rex', name: 'Rex' },
  },
];

beforeEach(() => {
  jest.mocked(authHooks.useProfile).mockReturnValue(query({ role: 'owner' }) as never);
  jest.mocked(careHooks.useCareEvents).mockReturnValue(query(events) as never);
  jest.mocked(careHooks.useVisitPhotos).mockReturnValue(query([]) as never);
  jest.mocked(careHooks.useIncidents).mockReturnValue(query([]) as never);
});

describe('OwnerVisitScreen', () => {
  it('shows the live status line, the timeline and the feed during the visit', async () => {
    jest.mocked(hooks.useOwnerVisit).mockReturnValue(query(baseVisit) as never);
    await render(<OwnerVisitScreen visitId="v1" />);

    expect(screen.getByText('“Out on a walk with Rex”')).toBeTruthy();
    expect(screen.getByLabelText(/^On the way, /)).toBeTruthy();
    expect(screen.getByLabelText(/^Arrived, /)).toBeTruthy();
    expect(screen.getByLabelText('Finished, not yet')).toBeTruthy();
    expect(screen.getByText('Live feed')).toBeTruthy();
    expect(screen.getByText('Walked Rex · 22 min')).toBeTruthy();
    expect(screen.queryByText('Report card')).toBeNull();
    expect(hooks.useVisitLiveUpdates).toHaveBeenCalledWith('v1');
  });

  it('shows the report card after check-out', async () => {
    jest.mocked(hooks.useOwnerVisit).mockReturnValue(
      query({
        ...baseVisit,
        status: 'completed',
        status_line: null,
        check_out_at: '2026-11-10T16:35:00Z',
        summary_note: 'Great walk, lots of sniffing.',
      }) as never,
    );
    await render(<OwnerVisitScreen visitId="v1" />);

    expect(screen.getByText('Report card')).toBeTruthy();
    expect(screen.getByText('Potty: peed 1×')).toBeTruthy();
    expect(screen.getByText('Walks: 1 (22 min)')).toBeTruthy();
    expect(screen.getByText('Great walk, lots of sniffing.')).toBeTruthy();
    expect(screen.getByRole('button', { name: "Rex's visit history" })).toBeTruthy();
  });

  it('shows incidents prominently', async () => {
    jest.mocked(hooks.useOwnerVisit).mockReturnValue(query(baseVisit) as never);
    jest.mocked(careHooks.useIncidents).mockReturnValue(
      query([
        {
          id: 'i1',
          severity: 'minor',
          description: 'Small scrape on the paw, cleaned it.',
          created_at: '2026-11-10T16:20:00Z',
          pet: { name: 'Rex' },
        },
      ]) as never,
    );
    await render(<OwnerVisitScreen visitId="v1" />);
    expect(screen.getByText('Small scrape on the paw, cleaned it.')).toBeTruthy();
  });
});
