import { binary, HttpError, readBinaryBody, withViewer } from '@/server/http';
import { relay } from '@/server/relay';
import { syncCatalog } from '@/server/syncCatalog';
import { saveSnapshot } from '@/server/teams';
import { decodeSyncRequest, encodeSyncResponse, MAX_SYNC_REQUEST_BYTES } from '@/sync/protocol';
import { decodeSnapshot } from '@/sync/snapshot';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sync — binary exchange within a team (see src/sync/protocol.ts).
 * Stores the player's snapshot if sent, marks them online, and returns who is
 * online plus every other player's snapshot stored since the client's last sync.
 * With `persist`, the player's snapshot is also saved to the database, which is
 * the only time a poll writes to it. Spectators only receive.
 */
export const POST = withViewer(async (request, viewer) => {
  const message = decodeSyncRequest(await readBinaryBody(request, MAX_SYNC_REQUEST_BYTES));
  const room = await relay.room(viewer.teamId);
  if (!room) throw new HttpError(401, 'This team no longer exists');
  const me = viewer.kind === 'player' ? viewer.player : null;
  let persisted = false;

  if (viewer.kind === 'player') {
    const { player, joinId } = viewer;
    if (!(await room.isMember(player, joinId))) throw new HttpError(401, 'You are no longer in this team');
    if (message.snapshot) {
      decodeSnapshot(message.snapshot, syncCatalog); // validate before relaying it
      room.store(player, joinId, message.rev, message.snapshot.slice());
    }
    room.markSeen(player);

    const entry = room.entry(player);
    if (entry && message.persist && entry.persistedRev < entry.rev) {
      const { rev, snapshot } = entry;
      if (!(await saveSnapshot(viewer.teamId, player, joinId, rev, snapshot))) {
        room.removeMember(player);
        throw new HttpError(401, 'You are no longer in this team');
      }
      room.markPersisted(player, rev);
    }
    persisted = !!entry && entry.persistedRev >= entry.rev;
  } else {
    if (message.snapshot) throw new HttpError(403, 'Spectators cannot change progress');
    if (!room.markSpectator(viewer.id)) throw new HttpError(503, 'This team has too many spectators, retrying…');
  }

  return binary(
    encodeSyncResponse({
      epoch: room.epoch,
      seq: room.seq,
      storedRev: me ? (room.entry(me)?.rev ?? 0) : 0,
      persisted,
      members: room.memberSlots(),
      online: room.online(),
      snapshots: room.changesFor(me, message.epoch, message.knownSeq),
    }),
  );
});
