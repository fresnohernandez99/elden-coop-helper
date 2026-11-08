import { notFound } from 'next/navigation';
import { JoinTeam } from '@/features/lobby/JoinTeam';
import { StatusScreen } from '@/features/player/StatusScreen';
import { ConfigError } from '@/server/config';
import { getTeam } from '@/server/teams';

export const dynamic = 'force-dynamic';

/** /team/<id>: the link the host shares. Join with the password or just watch. */
export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let team;
  try {
    team = await getTeam(id);
  } catch (error) {
    if (error instanceof ConfigError) return <StatusScreen>Incomplete configuration: {error.message}</StatusScreen>;
    throw error;
  }
  if (!team) notFound();
  return <JoinTeam team={{ ...team.info, players: team.members.map((m) => m.name) }} />;
}
