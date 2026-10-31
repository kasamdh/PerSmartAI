import { useState } from 'react';

import { BigButton } from '@/components/big-button';

import { signOut } from './api';

export function SignOutButton() {
  const [signingOut, setSigningOut] = useState(false);

  const onPress = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return <BigButton label="Sign out" variant="secondary" onPress={onPress} loading={signingOut} />;
}
