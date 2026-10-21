import { decodeSyncResponse, encodeSyncRequest, type SyncRequest, type SyncResponse } from '@/sync/protocol';
import { toApiError } from './http';

/** Client for POST /api/sync. Authenticated by the session cookie. */
export const syncApi = {
  async sync(request: SyncRequest): Promise<SyncResponse> {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: encodeSyncRequest(request) as Uint8Array<ArrayBuffer>,
    });
    if (!res.ok) throw await toApiError(res);
    return decodeSyncResponse(new Uint8Array(await res.arrayBuffer()));
  },
};

export type SyncApi = typeof syncApi;
