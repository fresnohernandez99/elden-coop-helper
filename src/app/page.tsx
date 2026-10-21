import { redirect } from 'next/navigation';
import { LoginForm } from '@/features/auth/LoginForm';
import { StatusScreen } from '@/features/player/StatusScreen';
import { ConfigError } from '@/server/config';
import { getSessionPlayer } from '@/server/session';

export const dynamic = 'force-dynamic';

/** Entry point: login with character name and password. Already logged in → map. */
export default async function LoginPage() {
  let loggedIn: boolean;
  try {
    loggedIn = (await getSessionPlayer()) !== null;
  } catch (error) {
    if (error instanceof ConfigError) return <StatusScreen>Incomplete configuration: {error.message}</StatusScreen>;
    throw error;
  }
  if (loggedIn) redirect('/map');
  return <LoginForm />;
}
