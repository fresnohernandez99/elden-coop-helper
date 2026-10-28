import { binary, HttpError, readBinaryBody, withViewer } from '@/server/http';
import { relay } from '@/server/relay';
import { syncCatalog } from '@/server/syncCatalog';
import { decodeSyncRequest, encodeSyncResponse, MAX_SYNC_REQUEST_BYTES } from '@/sync/protocol';
import { decodeSnapshot } from '@/sync/snapshot';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sync — binary exchange (see src/sync/protocol.ts).
 * Stores the player's snapshot if sent, marks them online, and returns who is
 * online plus every other player's snapshot stored since the client's last sync.
 * Spectators only receive: they cannot send a snapshot and only take a seat.
 */
export const POST = withViewer(async (request, viewer) => {
  const message = decodeSyncRequest(await readBinaryBody(request, MAX_SYNC_REQUEST_BYTES));
  const me = viewer.kind === 'player' ? viewer.player : null;

  if (viewer.kind === 'player') {
    if (message.snapshot) {
      decodeSnapshot(message.snapshot, syncCatalog); // validate before relaying it
      relay.store(viewer.player, message.rev, message.snapshot.slice());
    }
    relay.markSeen(viewer.player);
  } else {
    if (message.snapshot) throw new HttpError(403, 'Spectators cannot change progress');
    if (!relay.markSpectator(viewer.id)) throw new HttpError(503, 'Spectator room is full, retrying…');
  }

  return binary(
    encodeSyncResponse({
      epoch: relay.epoch,
      seq: relay.seq,
      storedRev: me ? relay.storedRev(me) : 0,
      online: relay.online(),
      snapshots: relay.changesFor(me, message.epoch, message.knownSeq),
    }),
  );
});
