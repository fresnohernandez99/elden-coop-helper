import { redirect } from 'next/navigation';
import { PlayerAppLoader } from '@/features/player/PlayerAppLoader';
import { StatusScreen } from '@/features/player/StatusScreen';
import { ConfigError, sessionFor } from '@/server/config';
import { getSessionViewer } from '@/server/session';

export const dynamic = 'force-dynamic';

/** /map: requires a session (player or spectator). Progress is loaded from the browser. */
export default async function MapPage() {
  let session;
  try {
    const viewer = await getSessionViewer();
    session = viewer && sessionFor(viewer.kind === 'player' ? viewer.player : null);
  } catch (error) {
    if (error instanceof ConfigError) return <StatusScreen>Incomplete configuration: {error.message}</StatusScreen>;
    throw error;
  }
  if (!session) redirect('/');
  return <PlayerAppLoader session={session} />;
}
