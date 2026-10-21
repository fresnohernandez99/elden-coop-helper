import { PLAYER_IDS } from '@/config/constants';
import { binary, readBinaryBody, withPlayer } from '@/server/http';
import { relay } from '@/server/relay';
import { syncCatalog } from '@/server/syncCatalog';
import { decodeSyncRequest, encodeSyncResponse, MAX_SYNC_MESSAGE_BYTES } from '@/sync/protocol';
import { decodeSnapshot } from '@/sync/snapshot';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sync — binary exchange (see src/sync/protocol.ts).
 * Stores the player's snapshot if sent and returns the other player's if it is newer.
 */
export const POST = withPlayer(async (request, me) => {
  const message = decodeSyncRequest(await readBinaryBody(request, MAX_SYNC_MESSAGE_BYTES));

  if (message.snapshot) {
    decodeSnapshot(message.snapshot, syncCatalog); // validate before relaying it
    relay.set(me, { rev: message.rev, snapshot: message.snapshot.slice() });
  }

  const other = PLAYER_IDS.find((p) => p !== me)!;
  const mine = relay.get(me);
  const theirs = relay.get(other);

  return binary(
    encodeSyncResponse({
      storedRev: mine?.rev ?? 0,
      otherRev: theirs?.rev ?? 0,
      otherSnapshot: theirs && theirs.rev > message.knownOtherRev ? theirs.snapshot : null,
    }),
  );
});
