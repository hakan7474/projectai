import { auth } from './auth';

export async function getAuthSession() {
  try {
    // NextAuth.js v5 automatically reads from request context in Next.js 16
    // No need to pass headers and cookies explicitly
    const session = await auth();
    return session;
  } catch (error) {
    console.error('Auth session error:', error);
    // If there's an error (e.g., no session), return null
    return null;
  }
}
