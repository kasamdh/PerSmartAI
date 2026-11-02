import { Image } from 'expo-image';
import { View } from 'react-native';

import { cachedImageSource } from '@/lib/image-cache';
import { useTheme } from '@/theme';

import { Icon } from './icon';

export type PetAvatarProps = {
  name: string;
  species?: 'dog' | 'cat' | string | null;
  /** Signed photo URL, or null to show the species icon. */
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
};

/** A pet's round photo, or a dog/cat icon on a soft tint when there's none. */
export function PetAvatar({ name, species, photoUrl, size = 'md' }: PetAvatarProps) {
  const theme = useTheme();
  const points = theme.size.avatar[size];
  const frame = { width: points, height: points, borderRadius: points / 2 };

  if (photoUrl) {
    return (
      <Image
        source={cachedImageSource(photoUrl)}
        cachePolicy="memory-disk"
        style={[frame, { backgroundColor: theme.colors.surfaceMuted }]}
        contentFit="cover"
        accessibilityLabel={`Photo of ${name}`}
      />
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={`${name}, no photo yet`}
      style={[
        frame,
        {
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Icon
        name={species === 'cat' ? 'cat' : species === 'dog' ? 'dog' : 'paw'}
        size={points * 0.5}
        color="primaryInk"
      />
    </View>
  );
}
