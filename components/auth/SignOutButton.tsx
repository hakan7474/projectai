'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
      Çıkış
    </Button>
  );
}

