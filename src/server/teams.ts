import 'server-only';
import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Binary, ObjectId } from 'mongodb';
import {
  CHARACTER_NAME_MAX_LENGTH,
  PLAYER_IDS,
  TEAM_NAME_MAX_LENGTH,
  TEAM_PASSWORD_ALPHABET,
  TEAM_PASSWORD_LENGTH,
  TEAMS_PAGE_SIZE,
} from '@/config/constants';
import type { PlayerId, TeamInfo, TeamRoster, TeamSummary } from '@/types/domain';
import { getDb } from './db';
import { HttpError } from './errors';

/**
 * Teams, stored in MongoDB for good (the collection is never cleaned up).
 *
 * A team holds who plays in it and the last saved snapshot of each player, so
 * spectators can see its state while nobody is online. Live progress travels
 * through the in-memory relay (relay.ts); snapshots are only saved now and then.
 *
 * Secrets are never stored in clear: the team password with scrypt (it is short),
 * the creator key and browser ids with SHA-256 (they are long and random).
 *
 * The owner (who can remove players and hand the team over) is the member whose
 * join id is `ownerJoinId`, so ownership follows the session and can be passed on.
 * The creator key, kept in the creator's browser, also proves ownership until the
 * team changes hands; teams created before `ownerJoinId` existed only have the key.
 * A team whose owner left with nobody to take over goes to the next player who joins.
 */

interface MemberDoc {
  slot: PlayerId;
  name: string;
  /** Random id of this membership; goes in the session cookie, so kicking someone invalidates it. */
  joinId: string;
  /** SHA-256 of the browser's clientId, so the host can ban that browser. */
  clientIdHash: string;
}

interface SnapshotDoc {
  rev: number;
  data: Binary;
}

interface TeamDoc {
  _id: ObjectId;
  name: string;
  passwordHash: string;
  passwordSalt: string;
  /** Removed once the team changes hands. */
  creatorKeyHash?: string;
  ownerJoinId?: string;
  members: MemberDoc[];
  banned: string[];
  snapshots: Partial<Record<PlayerId, SnapshotDoc>>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  slot: PlayerId;
  name: string;
  joinId: string;
}

export interface SavedSnapshot {
  player: PlayerId;
  rev: number;
  snapshot: Uint8Array;
}

/** A team without its secrets. */
export interface Team {
  info: TeamInfo;
  members: TeamMember[];
  snapshots: SavedSnapshot[];
}

/** Who asks for an owner action: their membership (from the session) and/or the creator key. */
export interface OwnerProof {
  joinId?: string;
  creatorKey?: unknown;
}

/** What the browser keeps after joining. */
export interface Membership {
  team: TeamInfo;
  slot: PlayerId;
  joinId: string;
}

const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;
const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url');
const randomToken = (bytes: number) => randomBytes(bytes).toString('base64url');
const hashPassword = async (password: string, salt: string) => (await scryptAsync(password, salt, 32)).toString('base64url');

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function collection() {
  return (await getDb()).collection<TeamDoc>('teams');
}

// ---- validation ----

const CONTROL_CHARS = /\p{Cc}/u;
const CLIENT_ID = /^[A-Za-z0-9_-]{16,64}$/;
const TEAM_ID = /^[0-9a-f]{24}$/;

/** Trims and collapses spaces; rejects empty, too long or control characters. */
function cleanName(value: unknown, maxLength: number, label: string): string {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!name) throw new HttpError(400, `Enter ${label}`);
  if ([...name].length > maxLength) throw new HttpError(400, `${label} can have up to ${maxLength} characters`);
  if (CONTROL_CHARS.test(name)) throw new HttpError(400, `${label} has invalid characters`);
  return name;
}

export const cleanTeamName = (value: unknown) => cleanName(value, TEAM_NAME_MAX_LENGTH, 'a team name');
export const cleanPlayerName = (value: unknown) => cleanName(value, CHARACTER_NAME_MAX_LENGTH, 'your name');

function cleanClientId(value: unknown): string {
  if (typeof value !== 'string' || !CLIENT_ID.test(value)) throw new HttpError(400, 'Invalid browser id');
  return value;
}

/** Team ids are Mongo ObjectIds in hex. Anything else is "not found". */
export function parseTeamId(value: unknown): ObjectId | null {
  return typeof value === 'string' && TEAM_ID.test(value) ? new ObjectId(value) : null;
}

/** Passwords are typed by people: case and spaces do not matter. */
const normalizePassword = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : '');

function generatePassword(): string {
  let password = '';
  for (let i = 0; i < TEAM_PASSWORD_LENGTH; i++) password += TEAM_PASSWORD_ALPHABET[randomInt(TEAM_PASSWORD_ALPHABET.length)];
  return password;
}

const sameName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

const toInfo = (doc: Pick<TeamDoc, '_id' | 'name'>): TeamInfo => ({ id: doc._id.toHexString(), name: doc.name });

const toMember = ({ slot, name, joinId }: MemberDoc): TeamMember => ({ slot, name, joinId });

type OwnerFields = Pick<TeamDoc, 'members' | 'ownerJoinId' | 'creatorKeyHash'>;

const ownerOf = (doc: OwnerFields): MemberDoc | undefined =>
  doc.ownerJoinId ? doc.members.find((m) => m.joinId === doc.ownerJoinId) : undefined;

/** Nobody can manage the team: its owner left and there is no creator key. */
const isOwnerless = (doc: OwnerFields) => !doc.creatorKeyHash && !ownerOf(doc);

function isOwner(doc: OwnerFields, proof: OwnerProof): boolean {
  if (proof.joinId && ownerOf(doc)?.joinId === proof.joinId) return true;
  return typeof proof.creatorKey === 'string' && !!doc.creatorKeyHash && sameSecret(sha256(proof.creatorKey), doc.creatorKeyHash);
}

const OWNER_PROJECTION = { members: 1, ownerJoinId: 1, creatorKeyHash: 1 } as const;

// ---- operations ----

export interface CreatedTeam extends Membership {
  /** Shown once to the host, who shares it with friends. */
  password: string;
  /** Also proves ownership, until the team changes hands. Only returned here; the browser keeps it. */
  creatorKey: string;
}

/** Creates a team with you as its first player (p1). */
export async function createTeam(input: { name: unknown; playerName: unknown; clientId: unknown }): Promise<CreatedTeam> {
  const name = cleanTeamName(input.name);
  const playerName = cleanPlayerName(input.playerName);
  const clientId = cleanClientId(input.clientId);

  const password = generatePassword();
  const passwordSalt = randomToken(16);
  const creatorKey = randomToken(16);
  const joinId = randomToken(9);
  const now = new Date();
  const doc: TeamDoc = {
    _id: new ObjectId(),
    name,
    passwordHash: await hashPassword(password, passwordSalt),
    passwordSalt,
    creatorKeyHash: sha256(creatorKey),
    ownerJoinId: joinId,
    members: [{ slot: 'p1', name: playerName, joinId, clientIdHash: sha256(clientId) }],
    banned: [],
    snapshots: {},
    createdAt: now,
    updatedAt: now,
  };
  await (await collection()).insertOne(doc);
  return { team: toInfo(doc), slot: 'p1', joinId, password, creatorKey };
}

/** Most recently active teams first, optionally filtered by name. */
export async function listTeams(input: { search?: unknown; page?: unknown }): Promise<TeamSummary[]> {
  const search = typeof input.search === 'string' ? input.search.trim().slice(0, TEAM_NAME_MAX_LENGTH) : '';
  const page = Math.max(0, Math.min(Number(input.page) || 0, 1000));
  const filter = search ? { name: { $regex: escapeRegex(search), $options: 'i' } } : {};
  const docs = await (await collection())
    .find(filter, { projection: { name: 1, 'members.name': 1 } })
    .sort({ updatedAt: -1 })
    .skip(page * TEAMS_PAGE_SIZE)
    .limit(TEAMS_PAGE_SIZE)
    .toArray();
  return docs.map((doc) => ({ ...toInfo(doc), players: doc.members.map((m) => m.name) }));
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The team with its members and last saved snapshots, or null if it does not exist. */
export async function getTeam(teamId: string): Promise<Team | null> {
  const _id = parseTeamId(teamId);
  if (!_id) return null;
  const doc = await (await collection()).findOne({ _id }, { projection: { name: 1, members: 1, snapshots: 1 } });
  if (!doc) return null;
  const snapshots = PLAYER_IDS.flatMap((player) => {
    const saved = doc.snapshots?.[player];
    return saved ? [{ player, rev: saved.rev, snapshot: new Uint8Array(saved.data.buffer) }] : [];
  });
  return { info: toInfo(doc), members: doc.members.map(toMember), snapshots };
}

/** Members by name and the owner's slot (null if unknown or gone), or null if the team does not exist. */
export async function getRoster(teamId: string): Promise<TeamRoster | null> {
  const _id = parseTeamId(teamId);
  if (!_id) return null;
  const doc = await (await collection()).findOne({ _id }, { projection: { members: 1, ownerJoinId: 1 } });
  if (!doc) return null;
  return { members: doc.members.map(({ slot, name }) => ({ slot, name })), owner: ownerOf(doc)?.slot ?? null };
}

/** Current members only (cheaper than getTeam), or null if the team does not exist. */
export async function getMembers(teamId: string): Promise<TeamMember[] | null> {
  const _id = parseTeamId(teamId);
  if (!_id) return null;
  const doc = await (await collection()).findOne({ _id }, { projection: { members: 1 } });
  return doc ? doc.members.map(toMember) : null;
}

const MAX_JOIN_ATTEMPTS = 3;

/**
 * Joins a team with its password. The same browser joining again gets its old
 * slot back (with the new name). Fails if the browser is banned, the name is
 * taken by someone else or the team is full.
 */
export async function joinTeam(
  teamId: string,
  input: { password: unknown; playerName: unknown; clientId: unknown },
): Promise<Membership> {
  const _id = parseTeamId(teamId);
  if (!_id) throw new HttpError(404, 'This team does not exist');
  const playerName = cleanPlayerName(input.playerName);
  const clientIdHash = sha256(cleanClientId(input.clientId));
  const teams = await collection();

  for (let attempt = 0; attempt < MAX_JOIN_ATTEMPTS; attempt++) {
    const doc = await teams.findOne(
      { _id },
      { projection: { name: 1, passwordHash: 1, passwordSalt: 1, banned: 1, ...OWNER_PROJECTION } },
    );
    if (!doc) throw new HttpError(404, 'This team does not exist');
    if (attempt === 0) {
      const hash = await hashPassword(normalizePassword(input.password), doc.passwordSalt);
      if (!sameSecret(hash, doc.passwordHash)) throw new HttpError(401, 'Wrong team password');
    }
    if (doc.banned.includes(clientIdHash)) throw new HttpError(403, 'You were removed from this team');

    const mine = doc.members.find((m) => m.clientIdHash === clientIdHash);
    if (mine) {
      if (doc.members.some((m) => m !== mine && sameName(m.name, playerName))) {
        throw new HttpError(409, 'Someone in this team already uses that name');
      }
      await teams.updateOne(
        { _id, members: { $elemMatch: { slot: mine.slot, clientIdHash } } },
        {
          $set: {
            'members.$.name': playerName,
            updatedAt: new Date(),
            ...(isOwnerless(doc) && { ownerJoinId: mine.joinId }),
          },
        },
      );
      return { team: toInfo(doc), slot: mine.slot, joinId: mine.joinId };
    }

    if (doc.members.some((m) => sameName(m.name, playerName))) {
      throw new HttpError(409, 'Someone in this team already uses that name');
    }
    const slot = PLAYER_IDS.find((id) => !doc.members.some((m) => m.slot === id));
    if (!slot) throw new HttpError(409, 'This team is full');

    const joinId = randomToken(9);
    // Only if nobody took the slot (or got banned) since the read; otherwise read again.
    const { modifiedCount } = await teams.updateOne(
      { _id, 'members.slot': { $ne: slot }, 'members.clientIdHash': { $ne: clientIdHash }, banned: { $ne: clientIdHash } },
      {
        $push: { members: { slot, name: playerName, joinId, clientIdHash } },
        $set: { updatedAt: new Date(), ...(isOwnerless(doc) && { ownerJoinId: joinId }) },
      },
    );
    if (modifiedCount === 1) return { team: toInfo(doc), slot, joinId };
  }
  throw new HttpError(409, 'The team changed while joining; try again');
}

/** The team as its owner sees it; throws unless the proof is the owner's. */
async function findAsOwner(teamId: string, proof: OwnerProof) {
  const _id = parseTeamId(teamId);
  if (!_id) throw new HttpError(404, 'This team does not exist');
  const teams = await collection();
  const doc = await teams.findOne({ _id }, { projection: OWNER_PROJECTION });
  if (!doc) throw new HttpError(404, 'This team does not exist');
  if (!isOwner(doc, proof)) throw new HttpError(403, 'Only the team owner can do that');
  return { _id, teams, doc };
}

/** The owner removes a player and bans their browser. Returns false if they were not in the team. */
export async function kickPlayer(teamId: string, proof: OwnerProof, slot: PlayerId): Promise<boolean> {
  const { _id, teams, doc } = await findAsOwner(teamId, proof);
  const member = doc.members.find((m) => m.slot === slot);
  if (!member) return false;
  await teams.updateOne(
    { _id },
    {
      $pull: { members: { slot, joinId: member.joinId } },
      $addToSet: { banned: member.clientIdHash },
      $unset: { [`snapshots.${slot}`]: '' },
      $set: { updatedAt: new Date() },
    },
  );
  return true;
}

/**
 * The owner hands the team over to another member. The creator key stops
 * working, so the new owner is the only one who can manage it.
 */
export async function transferOwnership(teamId: string, proof: OwnerProof, slot: PlayerId): Promise<void> {
  const { _id, teams, doc } = await findAsOwner(teamId, proof);
  const member = doc.members.find((m) => m.slot === slot);
  if (!member) throw new HttpError(404, 'That player is not in the team');
  const { matchedCount } = await teams.updateOne(
    { _id, members: { $elemMatch: { slot, joinId: member.joinId } } },
    { $set: { ownerJoinId: member.joinId, updatedAt: new Date() }, $unset: { creatorKeyHash: '' } },
  );
  if (matchedCount === 0) throw new HttpError(409, 'The team changed; try again');
}

/** Who leaves: a player by their session, or a browser by its clientId (from the lobby). */
export type Leaver = { slot: PlayerId; joinId: string } | { clientId: unknown };

/**
 * You leave the team: your slot and saved snapshot are deleted. If you owned
 * it, it goes to `newOwner` (or the first remaining player); with nobody left,
 * to the next player who joins. Returns the slot freed, or null if you were not in the team.
 */
export async function leaveTeam(
  teamId: string,
  leaver: Leaver,
  options: { creatorKey?: unknown; newOwner?: unknown } = {},
): Promise<PlayerId | null> {
  const _id = parseTeamId(teamId);
  if (!_id) return null;
  const teams = await collection();
  const doc = await teams.findOne({ _id }, { projection: OWNER_PROJECTION });
  if (!doc) return null;
  const member =
    'clientId' in leaver
      ? doc.members.find((m) => m.clientIdHash === sha256(cleanClientId(leaver.clientId)))
      : doc.members.find((m) => m.slot === leaver.slot && m.joinId === leaver.joinId);
  if (!member) return null;
  const { slot, joinId } = member;

  const set: Partial<TeamDoc> = { updatedAt: new Date() };
  const unset: Record<string, ''> = { [`snapshots.${slot}`]: '' };
  if (isOwner(doc, { joinId, creatorKey: options.creatorKey })) {
    const rest = doc.members.filter((m) => m !== member);
    const heir = rest.find((m) => m.slot === options.newOwner) ?? rest[0];
    if (heir) set.ownerJoinId = heir.joinId;
    else unset.ownerJoinId = '';
    unset.creatorKeyHash = '';
  }
  await teams.updateOne(
    { _id, members: { $elemMatch: { slot, joinId } } },
    { $pull: { members: { slot, joinId } }, $unset: unset, $set: set },
  );
  return slot;
}

/**
 * Saves a player's snapshot if they are still in the team and it is newer than
 * the saved one. Returns false only if they are no longer a member.
 */
export async function saveSnapshot(
  teamId: string,
  slot: PlayerId,
  joinId: string,
  rev: number,
  snapshot: Uint8Array,
): Promise<boolean> {
  const _id = parseTeamId(teamId);
  if (!_id) return false;
  const teams = await collection();
  const { matchedCount } = await teams.updateOne(
    { _id, members: { $elemMatch: { slot, joinId } }, [`snapshots.${slot}.rev`]: { $not: { $gte: rev } } },
    { $set: { [`snapshots.${slot}`]: { rev, data: new Binary(snapshot) }, updatedAt: new Date() } },
  );
  if (matchedCount === 1) return true;
  // Not saved: either a newer one already is (fine) or they left the team.
  return (await teams.countDocuments({ _id, members: { $elemMatch: { slot, joinId } } }, { limit: 1 })) === 1;
}
