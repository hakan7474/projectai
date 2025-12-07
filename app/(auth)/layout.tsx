import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth-helper';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  // If user is already logged in, redirect to dashboard
  if (session?.user) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}

