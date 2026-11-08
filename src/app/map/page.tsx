import { redirect } from 'next/navigation';
import { PlayerAppLoader } from '@/features/player/PlayerAppLoader';
import { StatusScreen } from '@/features/player/StatusScreen';
import { ConfigError, teamSessionFor } from '@/server/config';
import { getSessionViewer } from '@/server/session';
import { getTeam } from '@/server/teams';

export const dynamic = 'force-dynamic';

/**
 * /map: the map of your team, as a player or spectator. Requires a team session;
 * a player who is no longer in the team goes back to its join page.
 * Progress is loaded from the browser.
 */
export default async function MapPage() {
  let session;
  try {
    const viewer = await getSessionViewer();
    if (!viewer) redirect('/');
    const team = await getTeam(viewer.teamId);
    if (!team) redirect('/');
    const me = viewer.kind === 'player' ? viewer.player : null;
    if (viewer.kind === 'player' && !team.members.some((m) => m.slot === me && m.joinId === viewer.joinId)) {
      redirect(`/team/${team.info.id}`);
    }
    session = teamSessionFor(team.info, me, Object.fromEntries(team.members.map((m) => [m.slot, m.name])));
  } catch (error) {
    if (error instanceof ConfigError) return <StatusScreen>Incomplete configuration: {error.message}</StatusScreen>;
    throw error;
  }
  return <PlayerAppLoader session={session} />;
}
