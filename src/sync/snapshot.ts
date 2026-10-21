import { CHARACTER_NAME_MAX_LENGTH, MAP_SIZE, NOTE_MAX_LENGTH } from '@/config/constants';
import type { NextDestination, PlayerProgress } from '@/types/domain';
import { ByteReader, ByteWriter, DecodeError } from './binary';
import type { SyncCatalog } from './catalog';

/**
 * Binary snapshot of one player's progress.
 *
 *   u32      catalog hash
 *   varint   character name length in bytes, followed by the UTF-8 name
 *   u8       "found" encoding: 0 = bitset, 1 = delta list
 *   ...      "found" data
 *   u8       1 if there is a next destination, 0 otherwise
 *   u8       map index
 *   u16 ×2   lat, lng scaled from 0..256 to 0..65535
 *   varint   pin index + 1 (0 = free point)
 *   varint   note length in bytes, followed by the UTF-8 note
 *
 * With the current 1874 pins, "found" takes at most 235 bytes.
 */

/** The sender's pin catalog does not match the receiver's. */
export class CatalogMismatchError extends DecodeError {
  constructor() {
    super('The pin catalog does not match; reload the page');
    this.name = 'CatalogMismatchError';
  }
}

const FOUND_BITSET = 0;
const FOUND_DELTAS = 1;
const COORD_MAX = 0xffff;
const NOTE_MAX_BYTES = NOTE_MAX_LENGTH * 4; // UTF-8 worst case
const NAME_MAX_BYTES = CHARACTER_NAME_MAX_LENGTH * 4;

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

export function encodeSnapshot(progress: PlayerProgress, catalog: SyncCatalog): Uint8Array {
  const writer = new ByteWriter().u32(catalog.hash);
  writeText(writer, progress.name, CHARACTER_NAME_MAX_LENGTH);
  writeFound(writer, progress.found, catalog);
  writeNext(writer, progress.next, catalog);
  return writer.finish();
}

export function decodeSnapshot(bytes: Uint8Array, catalog: SyncCatalog): PlayerProgress {
  const reader = new ByteReader(bytes);
  if (reader.u32() !== catalog.hash) throw new CatalogMismatchError();
  const name = readText(reader, NAME_MAX_BYTES, CHARACTER_NAME_MAX_LENGTH);
  const found = readFound(reader, catalog);
  const next = readNext(reader, catalog);
  reader.expectEnd();
  return { name, found, next };
}

// --- text --------------------------------------------------------------------

function writeText(writer: ByteWriter, text: string, maxLength: number) {
  writer.sizedBytes(utf8Encoder.encode(text.slice(0, maxLength)));
}

function readText(reader: ByteReader, maxBytes: number, maxLength: number): string {
  const bytes = reader.sizedBytes(maxBytes);
  try {
    return utf8Decoder.decode(bytes).slice(0, maxLength);
  } catch {
    throw new DecodeError('Invalid UTF-8 text');
  }
}

// --- found -------------------------------------------------------------------

function writeFound(writer: ByteWriter, found: PlayerProgress['found'], catalog: SyncCatalog) {
  // Ids unknown to the catalog are dropped.
  const indices = Object.keys(found)
    .map((id) => catalog.indexOf(id))
    .filter((index): index is number => index !== undefined)
    .sort((a, b) => a - b);

  const deltas = encodeDeltas(indices);
  const bitset = encodeBitset(indices);
  // Few pins → the delta list is shorter; many → the bitset.
  if (deltas.length <= bitset.length) writer.u8(FOUND_DELTAS).bytes(deltas);
  else writer.u8(FOUND_BITSET).bytes(bitset);
}

/** varint count + gap between consecutive indices (almost always 1 byte each). */
function encodeDeltas(sortedIndices: number[]): Uint8Array {
  const writer = new ByteWriter().varint(sortedIndices.length);
  let previous = -1;
  for (const index of sortedIndices) {
    writer.varint(index - previous - 1);
    previous = index;
  }
  return writer.finish();
}

/** varint length + one bit per pin, without trailing empty bytes. */
function encodeBitset(sortedIndices: number[]): Uint8Array {
  const last = sortedIndices.at(-1);
  const bits = new Uint8Array(last === undefined ? 0 : (last >> 3) + 1);
  for (const index of sortedIndices) bits[index >> 3]! |= 1 << (index & 7);
  return new ByteWriter().sizedBytes(bits).finish();
}

function readFound(reader: ByteReader, catalog: SyncCatalog): PlayerProgress['found'] {
  const indices: number[] = [];
  const encoding = reader.u8();

  if (encoding === FOUND_DELTAS) {
    const count = reader.varint();
    if (count > catalog.size) throw new DecodeError('Too many pins');
    let index = -1;
    for (let i = 0; i < count; i++) {
      index += reader.varint() + 1;
      indices.push(index);
    }
  } else if (encoding === FOUND_BITSET) {
    const bits = reader.sizedBytes(Math.ceil(catalog.size / 8));
    bits.forEach((byte, i) => {
      for (let bit = 0; bit < 8; bit++) if (byte & (1 << bit)) indices.push(i * 8 + bit);
    });
  } else {
    throw new DecodeError(`Unknown encoding: ${encoding}`);
  }

  const found: PlayerProgress['found'] = {};
  for (const index of indices) {
    const pin = catalog.pinAt(index);
    if (!pin) throw new DecodeError(`Pin out of range: ${index}`);
    found[pin.id] = 0; // the exact time is not transmitted
  }
  return found;
}

// --- next --------------------------------------------------------------------

const encodeCoord = (value: number) => Math.round((Math.min(Math.max(value, 0), MAP_SIZE) / MAP_SIZE) * COORD_MAX);
const decodeCoord = (value: number) => Math.round(((value / COORD_MAX) * MAP_SIZE) * 100) / 100;

function writeNext(writer: ByteWriter, next: NextDestination | null, catalog: SyncCatalog) {
  const areaIndex = next ? catalog.areas.indexOf(next.area) : -1;
  if (!next || areaIndex < 0) {
    writer.u8(0);
    return;
  }
  const pinIndex = next.pinId === null ? undefined : catalog.indexOf(next.pinId);
  writer
    .u8(1)
    .u8(areaIndex)
    .u16(encodeCoord(next.lat))
    .u16(encodeCoord(next.lng))
    .varint(pinIndex === undefined ? 0 : pinIndex + 1);
  writeText(writer, next.note, NOTE_MAX_LENGTH);
}

function readNext(reader: ByteReader, catalog: SyncCatalog): NextDestination | null {
  const hasNext = reader.u8();
  if (hasNext === 0) return null;
  if (hasNext !== 1) throw new DecodeError('Invalid destination flag');

  const area = catalog.areas[reader.u8()];
  if (area === undefined) throw new DecodeError('Unknown map');
  let lat = decodeCoord(reader.u16());
  let lng = decodeCoord(reader.u16());

  const pinRef = reader.varint();
  const pin = pinRef === 0 ? undefined : catalog.pinAt(pinRef - 1);
  if (pinRef !== 0 && !pin) throw new DecodeError('Unknown destination pin');
  // When the destination is a pin, use its exact catalog coordinates.
  const [pinLat, pinLng] = pin?.latlng ?? [];
  if (pinLat !== undefined && pinLng !== undefined) [lat, lng] = [pinLat, pinLng];

  const note = readText(reader, NOTE_MAX_BYTES, NOTE_MAX_LENGTH);
  return { area, lat, lng, note, pinId: pin?.id ?? null };
}
