import { binary, readBinaryBody, withPlayer } from '@/server/http';
import { relay } from '@/server/relay';
import { syncCatalog } from '@/server/syncCatalog';
import { decodeSyncRequest, encodeSyncResponse, MAX_SYNC_REQUEST_BYTES } from '@/sync/protocol';
import { decodeSnapshot } from '@/sync/snapshot';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sync — binary exchange (see src/sync/protocol.ts).
 * Stores the player's snapshot if sent, marks them online, and returns who is
 * online plus every other player's snapshot stored since the client's last sync.
 */
export const POST = withPlayer(async (request, me) => {
  const message = decodeSyncRequest(await readBinaryBody(request, MAX_SYNC_REQUEST_BYTES));

  if (message.snapshot) {
    decodeSnapshot(message.snapshot, syncCatalog); // validate before relaying it
    relay.store(me, message.rev, message.snapshot.slice());
  }
  relay.markSeen(me);

  return binary(
    encodeSyncResponse({
      epoch: relay.epoch,
      seq: relay.seq,
      storedRev: relay.storedRev(me),
      online: relay.online(),
      snapshots: relay.changesFor(me, message.epoch, message.knownSeq),
    }),
  );
});
