import { Stack, useLocalSearchParams } from 'expo-router';

import { PetGalleryScreen } from '@/features/media/pet-gallery-screen';
import { usePet } from '@/features/pets/hooks';

export default function PetGalleryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const name = usePet(id).data?.name ?? 'Your pet';
  return (
    <>
      <Stack.Screen options={{ title: `${name}'s photos` }} />
      <PetGalleryScreen petId={id} petName={name} />
    </>
  );
}
