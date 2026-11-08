import { Lobby } from '@/features/lobby/Lobby';
import { StatusScreen } from '@/features/player/StatusScreen';
import { ConfigError } from '@/server/config';
import { getSessionViewer } from '@/server/session';

export const dynamic = 'force-dynamic';

/** Entry point: the lobby. Offers to continue in the team of the current session, if any. */
export default async function LobbyPage() {
  let viewer;
  try {
    viewer = await getSessionViewer();
  } catch (error) {
    if (error instanceof ConfigError) return <StatusScreen>Incomplete configuration: {error.message}</StatusScreen>;
    throw error;
  }
  return <Lobby current={viewer && { teamId: viewer.teamId, spectator: viewer.kind === 'spectator' }} />;
}
