import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { PetAvatar } from '@/components/ui';
import { useProfile } from '@/features/auth/use-profile';
import { useBrand } from '@/features/branding/brand-context';
import { useUnreadCount } from '@/features/chat/hooks';
import { usePetPhotoUrl, usePets } from '@/features/pets/hooks';
import { petRouteFor } from '@/features/pets/routes';

import { useOwnerVisits, useOwnerVisitsLiveUpdates } from './hooks';
import { OwnerHomeView, type HomePet, type HomeVisit } from './owner-home-view';
import { partitionOwnerVisits } from './owner-visits';

function PetPhoto({ pet }: { pet: HomePet & { photo_url?: string | null } }) {
  const url = usePetPhotoUrl(pet.photo_url);
  return <PetAvatar name={pet.name} species={pet.species} photoUrl={url.data ?? null} />;
}

/** The owner's home: live visit first, pets with allergies, what's coming, one main action. */
export function OwnerHomeScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const brand = useBrand();
  const visits = useOwnerVisits();
  const pets = usePets();
  const unread = useUnreadCount().data ?? 0;
  useOwnerVisitsLiveUpdates();

  const now = new Date();
  const groups = useMemo(
    () => partitionOwnerVisits((visits.data ?? []) as HomeVisit[], new Date()),
    [visits.data],
  );

  return (
    <OwnerHomeView
      firstName={profile?.full_name.split(' ')[0] ?? null}
      business={{ name: brand.name, logoUrl: brand.logoUrl }}
      visits={
        visits.isPending
          ? { state: 'loading' }
          : visits.isError
            ? { state: 'error', retry: () => void visits.refetch() }
            : { state: 'ready', data: groups }
      }
      pets={
        pets.isPending
          ? { state: 'loading' }
          : pets.isError
            ? { state: 'error', retry: () => void pets.refetch() }
            : { state: 'ready', data: pets.data as HomePet[] }
      }
      unreadMessages={unread}
      now={now}
      refreshing={visits.isRefetching || pets.isRefetching}
      onRefresh={() => {
        void visits.refetch();
        void pets.refetch();
      }}
      renderPetAvatar={(pet) => <PetPhoto pet={pet} />}
      onOpenVisit={(id) => router.push({ pathname: '/visits/[id]', params: { id } })}
      onOpenPet={(id) => router.push(petRouteFor('owner', id))}
      onAddPet={() => router.push('/pets/new')}
      onBook={() => router.push('/my-bookings/new')}
      onAllBookings={() => router.push('/my-bookings')}
      onMessages={() => router.push('/messages')}
      onProfile={() => router.push('/profile')}
      onHousehold={() => router.push('/household')}
      onNotifications={() => router.push('/notifications')}
    />
  );
}
