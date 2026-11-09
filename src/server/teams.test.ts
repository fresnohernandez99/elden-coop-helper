import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb } from './db';
import { HttpError } from './errors';
import { relay } from './relay';
import {
  createTeam,
  getRoster,
  getTeam,
  joinTeam,
  kickPlayer,
  leaveTeam,
  listTeams,
  saveSnapshot,
  transferOwnership,
  type CreatedTeam,
} from './teams';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = 'test';
  process.env.SESSION_SECRET = 'test-secret-with-enough-length';
});

afterAll(async () => {
  await closeDb();
  await mongo?.stop();
});

beforeEach(async () => {
  await (await getDb()).collection('teams').deleteMany({});
});

const clientId = (n: number) => `client-id-number-${n}`.padEnd(20, 'x');

const create = (name = 'Tarnished', playerName = 'Host') => createTeam({ name, playerName, clientId: clientId(1) });

const join = (team: CreatedTeam, playerName: string, n: number, password = team.password) =>
  joinTeam(team.team.id, { password, playerName, clientId: clientId(n) });

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpError);
  expect((error as HttpError).status).toBe(status);
}

describe('teams', () => {
  it('creates a team with a 6-letter password and the host in p1', async () => {
    const team = await create();
    expect(team.password).toMatch(/^[A-HJ-NP-Z]{6}$/);
    expect(team.slot).toBe('p1');
    const saved = await getTeam(team.team.id);
    expect(saved?.members.map((m) => m.name)).toEqual(['Host']);
    const raw = await (await getDb()).collection('teams').findOne({});
    expect(JSON.stringify(raw)).not.toContain(team.password);
    expect(JSON.stringify(raw)).not.toContain(team.creatorKey);
  });

  it('rejects invalid team names', async () => {
    await expectStatus(create(''), 400);
    await expectStatus(create('Eleven chars'), 400);
    await expect(create('Ten chars!')).resolves.toBeTruthy();
  });

  it('allows repeated team names', async () => {
    const a = await create('Same');
    const b = await create('Same');
    expect(a.team.id).not.toBe(b.team.id);
  });

  it('lets up to 3 players join with the password, in any case', async () => {
    const team = await create();
    expect((await join(team, 'Ana', 2, team.password.toLowerCase())).slot).toBe('p2');
    expect((await join(team, 'Bea', 3)).slot).toBe('p3');
    await expectStatus(join(team, 'Carl', 4), 409);
  });

  it('rejects a wrong password and a name already used by someone else', async () => {
    const team = await create();
    await expectStatus(join(team, 'Ana', 2, 'WRONGG'), 401);
    await expectStatus(join(team, 'host', 2), 409);
  });

  it('gives the same browser its slot back', async () => {
    const team = await create();
    const first = await join(team, 'Ana', 2);
    const again = await join(team, 'Ana the Bold', 2);
    expect(again).toEqual(first);
    expect((await getTeam(team.team.id))?.members.find((m) => m.slot === 'p2')?.name).toBe('Ana the Bold');
  });

  it('only lets the owner kick, and bans the kicked browser', async () => {
    const team = await create();
    const ana = await join(team, 'Ana', 2);
    await join(team, 'Bob', 3);
    await expectStatus(kickPlayer(team.team.id, { creatorKey: 'not-the-key' }, 'p2'), 403);
    await expectStatus(kickPlayer(team.team.id, { joinId: ana.joinId }, 'p3'), 403);
    expect(await kickPlayer(team.team.id, { creatorKey: team.creatorKey }, 'p2')).toBe(true);
    expect(await kickPlayer(team.team.id, { joinId: team.joinId }, 'p3')).toBe(true);
    await expectStatus(join(team, 'Ana', 2), 403);
    expect((await join(team, 'Other', 4)).slot).toBe('p2');
  });

  it('frees the slot and deletes the saved snapshot when a player leaves', async () => {
    const team = await create();
    const ana = await join(team, 'Ana', 2);
    await saveSnapshot(team.team.id, 'p2', ana.joinId, 3, new Uint8Array([3]));
    expect(await leaveTeam(team.team.id, { slot: ana.slot, joinId: ana.joinId })).toBe('p2');
    const saved = await getTeam(team.team.id);
    expect(saved?.members).toHaveLength(1);
    expect(saved?.snapshots).toEqual([]);
  });

  it('lets a browser leave by its client id (from the lobby)', async () => {
    const team = await create();
    await join(team, 'Ana', 2);
    expect(await leaveTeam(team.team.id, { clientId: clientId(9) })).toBeNull();
    expect(await leaveTeam(team.team.id, { clientId: clientId(2) })).toBe('p2');
    expect((await getRoster(team.team.id))?.members.map((m) => m.name)).toEqual(['Host']);
  });

  it('hands the team over, and the creator key stops working', async () => {
    const team = await create();
    const ana = await join(team, 'Ana', 2);
    await join(team, 'Bob', 3);
    expect((await getRoster(team.team.id))?.owner).toBe('p1');
    await expectStatus(transferOwnership(team.team.id, { joinId: ana.joinId }, 'p2'), 403);
    await transferOwnership(team.team.id, { joinId: team.joinId }, 'p2');
    expect((await getRoster(team.team.id))?.owner).toBe('p2');
    await expectStatus(kickPlayer(team.team.id, { creatorKey: team.creatorKey }, 'p3'), 403);
    expect(await kickPlayer(team.team.id, { joinId: ana.joinId }, 'p1')).toBe(true);
  });

  it('passes the team to the chosen player when the owner leaves', async () => {
    const team = await create();
    await join(team, 'Ana', 2);
    await join(team, 'Bob', 3);
    await leaveTeam(team.team.id, { slot: 'p1', joinId: team.joinId }, { newOwner: 'p3' });
    expect((await getRoster(team.team.id))?.owner).toBe('p3');
  });

  it('passes the team to the first player left, or to the next one who joins', async () => {
    const team = await create();
    const ana = await join(team, 'Ana', 2);
    await leaveTeam(team.team.id, { clientId: clientId(1) }, { newOwner: 'p9' });
    expect((await getRoster(team.team.id))?.owner).toBe('p2');
    await leaveTeam(team.team.id, { slot: 'p2', joinId: ana.joinId });
    expect((await getRoster(team.team.id))?.owner).toBeNull();
    const bob = await join(team, 'Bob', 3);
    expect((await getRoster(team.team.id))?.owner).toBe(bob.slot);
  });

  it('keeps teams created before ownership could be passed on working with the creator key', async () => {
    const team = await create();
    await join(team, 'Ana', 2);
    await (await getDb()).collection('teams').updateOne({}, { $unset: { ownerJoinId: '' } });
    expect((await getRoster(team.team.id))?.owner).toBeNull();
    await expectStatus(kickPlayer(team.team.id, { joinId: team.joinId }, 'p2'), 403);
    await transferOwnership(team.team.id, { creatorKey: team.creatorKey }, 'p2');
    expect((await getRoster(team.team.id))?.owner).toBe('p2');
  });

  it('saves only newer snapshots of current members', async () => {
    const team = await create();
    const data = new Uint8Array([1, 2, 3]);
    expect(await saveSnapshot(team.team.id, 'p1', team.joinId, 10, data)).toBe(true);
    expect(await saveSnapshot(team.team.id, 'p1', team.joinId, 5, new Uint8Array([9]))).toBe(true);
    expect((await getTeam(team.team.id))?.snapshots).toEqual([{ player: 'p1', rev: 10, snapshot: data }]);
    expect(await saveSnapshot(team.team.id, 'p1', 'someone-else', 20, data)).toBe(false);
  });

  it('lists the most recently active teams first and searches by name', async () => {
    const old = await create('Old');
    await create('New');
    await saveSnapshot(old.team.id, 'p1', old.joinId, 1, new Uint8Array([1]));
    expect((await listTeams({})).map((t) => t.name)).toEqual(['Old', 'New']);
    expect((await listTeams({ search: 'ne' })).map((t) => t.name)).toEqual(['New']);
    expect((await listTeams({ search: '.*' })).length).toBe(0);
  });
});

describe('relay', () => {
  it('loads the last saved snapshots once and drops kicked players', async () => {
    const team = await create();
    const ana = await join(team, 'Ana', 2);
    await saveSnapshot(team.team.id, 'p2', ana.joinId, 7, new Uint8Array([7]));

    const room = (await relay.room(team.team.id))!;
    expect(room.changesFor(null, 0, 0)).toEqual([{ player: 'p2', rev: 7, snapshot: new Uint8Array([7]) }]);
    expect(room.entry('p2')?.persistedRev).toBe(7);
    expect(await room.isMember('p2', ana.joinId)).toBe(true);

    await kickPlayer(team.team.id, { creatorKey: team.creatorKey }, 'p2');
    room.removeMember('p2');
    expect(await room.isMember('p2', ana.joinId)).toBe(false);
    expect(room.changesFor(null, 0, 0)).toEqual([]);
    expect(room.memberSlots()).toEqual(['p1']);
  });

  it('notices a player who joined on another instance', async () => {
    const team = await create();
    const room = (await relay.room(team.team.id))!;
    const ana = await join(team, 'Ana', 2);
    expect(await room.isMember('p2', ana.joinId)).toBe(true);
  });

  it('returns null for a team that does not exist', async () => {
    expect(await relay.room('0123456789abcdef01234567')).toBeNull();
  });
});
