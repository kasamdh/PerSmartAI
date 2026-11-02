import { useRouter } from 'expo-router';

import { Button } from '@/components/ui';

/** Development builds only: opens the design system preview. */
export function DesignPreviewLink() {
  const router = useRouter();
  if (!__DEV__) return null;
  return (
    <Button
      label="Design preview (dev only)"
      variant="ghost"
      icon="sun"
      onPress={() => router.push('/design-preview')}
    />
  );
}
