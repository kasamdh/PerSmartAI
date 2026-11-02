import { useRouter } from 'expo-router';

import { BigButton } from '@/components/big-button';
import { FormScreen } from '@/components/form-screen';
import { DesignPreviewLink } from '@/features/design-preview/design-preview-link';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <FormScreen
      title="Pet Sitter App"
      subtitle="Live updates and photos for dogs and cats, from the people who care for them."
    >
      <BigButton label="Log in" onPress={() => router.push('/sign-in')} />
      <BigButton
        label="I have an invite code"
        variant="secondary"
        onPress={() => router.push('/accept-invite')}
      />
      <BigButton
        label="Start a pet-sitting business"
        variant="secondary"
        onPress={() => router.push('/sign-up')}
      />
      <DesignPreviewLink />
    </FormScreen>
  );
}
