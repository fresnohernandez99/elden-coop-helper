import { PlayerAppLoader } from '@/features/player/PlayerAppLoader';
import { soloSession } from '@/server/config';

/** /solo: the map on your own. Progress stays in the browser and nothing is synced. */
export default function SoloPage() {
  return <PlayerAppLoader session={soloSession()} />;
}
