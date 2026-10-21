import { redirect } from 'next/navigation';
import { PlayerAppLoader } from '@/features/player/PlayerAppLoader';
import { StatusScreen } from '@/features/player/StatusScreen';
import { ConfigError, sessionFor } from '@/server/config';
import { getSessionPlayer } from '@/server/session';

export const dynamic = 'force-dynamic';

/** /map: requires a session. Progress is loaded from the browser. */
export default async function MapPage() {
  let session;
  try {
    const me = await getSessionPlayer();
    session = me && sessionFor(me);
  } catch (error) {
    if (error instanceof ConfigError) return <StatusScreen>Incomplete configuration: {error.message}</StatusScreen>;
    throw error;
  }
  if (!session) redirect('/');
  return <PlayerAppLoader session={session} />;
}
