import { Redirect, Stack } from 'expo-router';

import { DesignPreviewScreen } from '@/features/design-preview/design-preview-screen';

// Development builds only; store builds never show it.
export default function DesignPreview() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Design preview' }} />
      <DesignPreviewScreen />
    </>
  );
}
