import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PetAvatar } from '@/components/ui';
import { samplePets, sampleVisitGroups } from '@/features/design-preview/sample-data';
import { ThemeProvider } from '@/theme';

import { OwnerHomeView, type OwnerHomeViewProps } from '../owner-home-view';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderHome(overrides: Partial<OwnerHomeViewProps> = {}) {
  const handlers = {
    onOpenVisit: jest.fn(),
    onOpenPet: jest.fn(),
    onAddPet: jest.fn(),
    onBook: jest.fn(),
    onAllBookings: jest.fn(),
    onMessages: jest.fn(),
    onProfile: jest.fn(),
    onHousehold: jest.fn(),
    onNotifications: jest.fn(),
    onSignOut: jest.fn(),
    onRefresh: jest.fn(),
  };
  const props: OwnerHomeViewProps = {
    firstName: 'Rudra',
    business: { name: 'Happy Paws', logoUrl: null },
    visits: { state: 'ready', data: sampleVisitGroups },
    pets: { state: 'ready', data: samplePets },
    unreadMessages: 2,
    now: new Date(),
    refreshing: false,
    renderPetAvatar: (pet) => <PetAvatar name={pet.name} species={pet.species} />,
    ...handlers,
    ...overrides,
  };
  const view = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <OwnerHomeView {...props} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return { view, handlers };
}

describe('OwnerHomeView', () => {
  it('greets the owner and says what is happening now', async () => {
    await renderHome();
    expect(screen.getByRole('header', { name: 'Hi, Rudra' })).toBeTruthy();
    expect(screen.getByText('Monika is with Max now')).toBeTruthy();
    expect(screen.getByText('“Out at the park, Max is loving it”')).toBeTruthy();
  });

  it('has one main action, Book a visit', async () => {
    const { handlers } = await renderHome();
    await fireEvent.press(screen.getByRole('button', { name: 'Book a visit' }));
    expect(handlers.onBook).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Add your first pet' })).toBeNull();
  });

  it('shows allergies on the pet card without a tap', async () => {
    await renderHome();
    expect(screen.getByLabelText('Allergies: Chicken (severe), Pollen (mild)')).toBeTruthy();
  });

  it('labels icon buttons for screen readers, with the unread count', async () => {
    const { handlers } = await renderHome();
    await fireEvent.press(screen.getByRole('button', { name: 'Messages, 2 new' }));
    expect(handlers.onMessages).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'My profile' })).toBeTruthy();
  });

  it('asks for a pet first when there are none', async () => {
    const { handlers } = await renderHome({ pets: { state: 'ready', data: [] } });
    await fireEvent.press(screen.getByRole('button', { name: 'Add your first pet' }));
    expect(handlers.onAddPet).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Book a visit' })).toBeNull();
  });

  it('shows skeletons while loading and a retry on errors', async () => {
    const retry = jest.fn();
    await renderHome({ visits: { state: 'loading' }, pets: { state: 'error', retry } });
    expect(screen.getByLabelText('Loading your visits')).toBeTruthy();
    expect(screen.getByText('Couldn’t load your pets')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });

  it('lets the owner sign out from the home screen', async () => {
    const { handlers } = await renderHome();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(handlers.onSignOut).toHaveBeenCalled();
  });
});
