import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AllergyBanner } from '../allergy-banner';
import * as hooks from '../hooks';
import { PetDetailScreen } from '../pet-detail-screen';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../hooks');

const mockedHooks = jest.mocked(hooks);

const rex = {
  id: 'p3',
  name: 'Rex',
  species: 'dog',
  breed: 'German Shepherd',
  birth_date: '2018-02-20',
  weight_kg: 36,
  sex: 'male',
  spayed_neutered: false,
  microchip: null,
  photo_url: null,
  temperament_notes: 'Reactive to other dogs.',
  vet_name: 'Park Slope Vet',
  vet_phone: '+15555550500',
  vet_address: '210 7th Ave',
  pet_allergies: [
    { id: 'a1', allergen: 'Pollen', severity: 'mild', reaction_notes: null },
    { id: 'a2', allergen: 'Bee stings', severity: 'severe', reaction_notes: 'Call the vet' },
  ],
  pet_medications: [
    {
      id: 'm1',
      name: 'Apoquel',
      dose: '16 mg',
      instructions: 'With food',
      schedule_times: ['08:00:00', '18:00:00'],
    },
  ],
  feeding_plans: [
    {
      id: 'f1',
      food_brand: 'Orijen',
      amount: 3,
      unit: 'cup',
      times: ['08:00:00'],
      treats_allowed: true,
      notes: null,
    },
  ],
  household: {
    id: 'h2',
    name: "Oscar's apartment",
    emergency_contacts: [
      {
        id: 'c2',
        name: 'Backup',
        relationship: 'Friend',
        phone: '+15555550999',
        is_primary: false,
      },
      {
        id: 'c1',
        name: 'Oscar Owner',
        relationship: 'Owner',
        phone: '+15555550202',
        is_primary: true,
      },
    ],
  },
};

beforeEach(() => {
  mockedHooks.usePet.mockReturnValue({
    isPending: false,
    isError: false,
    data: rex,
    isRefetching: false,
  } as never);
  mockedHooks.usePetPhotoUrl.mockReturnValue({ data: undefined } as never);
});

describe('AllergyBanner', () => {
  it('renders nothing without allergies', async () => {
    await render(<AllergyBanner allergies={[]} />);
    expect(screen.queryByTestId('allergy-banner')).toBeNull();
  });

  it('shows every allergy with severe ones in bold', async () => {
    await render(<AllergyBanner allergies={rex.pet_allergies as never} />);
    const banner = screen.getByTestId('allergy-banner');

    const severe = within(banner).getByText(/Bee stings · SEVERE/);
    const mild = within(banner).getByText(/Pollen · MILD/);
    expect(StyleSheet.flatten(severe.props.style).fontWeight).toBe('800');
    expect(StyleSheet.flatten(mild.props.style).fontWeight).toBeUndefined();
  });
});

describe('PetDetailScreen', () => {
  it('puts the allergy banner first, even in the read-only sitter view', async () => {
    await render(<PetDetailScreen petId="p3" editable={false} />);

    const banner = screen.getByTestId('allergy-banner');
    expect(banner.props.accessibilityLabel).toBe('Allergies: Bee stings (severe), Pollen (mild)');
    // Rendered before the pet's name and every section.
    const texts = screen.getAllByText(/.+/).map((el) => String(el.props.children));
    const bannerAt = texts.findIndex((t) => t.includes('ALLERGIES'));
    expect(bannerAt).toBe(0);
    for (const later of ['Rex', 'Feeding', 'Medications', 'Vet', 'Emergency contacts']) {
      expect(bannerAt).toBeLessThan(texts.indexOf(later));
    }
  });

  it('shows feeding, medications, temperament, vet, and contacts (primary first)', async () => {
    await render(<PetDetailScreen petId="p3" editable={false} />);

    expect(screen.getByText(/3 cup Orijen/)).toBeTruthy();
    expect(screen.getByText('At 8:00 AM, 6:00 PM')).toBeTruthy();
    expect(screen.getByText('Reactive to other dogs.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Call Park Slope Vet, +15555550500' })).toBeTruthy();

    const contacts = screen.getAllByRole('button', { name: /^Call (Oscar Owner|Backup)/ });
    expect(contacts[0].props.accessibilityLabel).toMatch(/^Call Oscar Owner \(primary\)/);
  });

  it('is read-only for sitters and admins', async () => {
    await render(<PetDetailScreen petId="p3" editable={false} />);
    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
  });

  it('offers edit links to owners', async () => {
    await render(<PetDetailScreen petId="p3" editable />);
    expect(screen.getByRole('button', { name: 'Edit Feeding' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit emergency contacts' })).toBeTruthy();
  });

  it('handles loading, error, and missing pets', async () => {
    mockedHooks.usePet.mockReturnValue({ isPending: true } as never);
    const { rerender } = await render(<PetDetailScreen petId="p3" editable />);
    expect(screen.getByLabelText('Loading pet')).toBeTruthy();

    mockedHooks.usePet.mockReturnValue({
      isPending: false,
      isError: true,
      refetch: jest.fn(),
    } as never);
    await rerender(<PetDetailScreen petId="p3" editable />);
    expect(screen.getByText("Couldn't load this pet")).toBeTruthy();

    mockedHooks.usePet.mockReturnValue({ isPending: false, isError: false, data: null } as never);
    await rerender(<PetDetailScreen petId="p3" editable />);
    expect(screen.getByText('Pet not found')).toBeTruthy();
  });
});
