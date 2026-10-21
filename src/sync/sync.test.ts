import { describe, expect, it } from 'vitest';
import pinsData from '../../public/data/pins.json';
import type { PlayerProgress } from '@/types/domain';
import { ByteReader, ByteWriter, DecodeError } from './binary';
import { createSyncCatalog } from './catalog';
import { decodeSyncRequest, decodeSyncResponse, encodeSyncRequest, encodeSyncResponse } from './protocol';
import { CatalogMismatchError, decodeSnapshot, encodeSnapshot } from './snapshot';

const catalog = createSyncCatalog(
  pinsData.pins,
  pinsData.maps.map((m) => m.title),
);
const allIds = pinsData.pins.map((p) => p.id);
const located = pinsData.pins.find((p) => p.latlng)!;

const progress = (ids: string[], next: PlayerProgress['next'] = null, name = ''): PlayerProgress => ({
  name,
  found: Object.fromEntries(ids.map((id) => [id, 0])),
  next,
});

describe('binary', () => {
  it('encodes varints of different sizes', () => {
    const values = [0, 1, 127, 128, 300, 2 ** 31, Date.now(), Number.MAX_SAFE_INTEGER];
    const writer = new ByteWriter();
    values.forEach((v) => writer.varint(v));
    const reader = new ByteReader(writer.finish());
    expect(values.map(() => reader.varint())).toEqual(values);
    reader.expectEnd();
  });

  it('fails on a truncated message', () => {
    expect(() => new ByteReader(new Uint8Array([0x80])).varint()).toThrow(DecodeError);
  });
});

describe('snapshot', () => {
  it('round-trips empty progress', () => {
    const bytes = encodeSnapshot(progress([]), catalog);
    expect(decodeSnapshot(bytes, catalog)).toEqual(progress([]));
    expect(bytes.length).toBeLessThanOrEqual(8);
  });

  it('uses the delta list for a few pins', () => {
    const ids = allIds.slice(0, 10);
    const bytes = encodeSnapshot(progress(ids), catalog);
    expect(Object.keys(decodeSnapshot(bytes, catalog).found).sort()).toEqual([...ids].sort());
    expect(bytes.length).toBeLessThan(30);
  });

  it('stays within the bitset size when every pin is found', () => {
    const bytes = encodeSnapshot(progress(allIds), catalog);
    expect(Object.keys(decodeSnapshot(bytes, catalog).found)).toHaveLength(allIds.length);
    // hash + empty name + encoding + bitset length + bitset + no destination
    expect(bytes.length).toBeLessThanOrEqual(4 + 1 + 1 + 2 + Math.ceil(allIds.length / 8) + 1);
  });

  it('keeps the character name and truncates it to the maximum', () => {
    const decoded = decodeSnapshot(encodeSnapshot(progress([], null, 'Tarnished of the Ñ'), catalog), catalog);
    expect(decoded.name).toBe('Tarnished of the Ñ');
    const long = decodeSnapshot(encodeSnapshot(progress([], null, 'x'.repeat(100)), catalog), catalog);
    expect(long.name).toHaveLength(32);
  });

  it('keeps a pin destination with its exact coordinates', () => {
    const next = {
      area: located.area,
      lat: located.latlng![0]!,
      lng: located.latlng![1]!,
      note: 'Going for Margit ⚔️',
      pinId: located.id,
    };
    expect(decodeSnapshot(encodeSnapshot(progress([], next), catalog), catalog).next).toEqual(next);
  });

  it('approximates a free point within 0.01 units', () => {
    const next = { area: 'Underground', lat: 123.456, lng: 7.89, note: '', pinId: null };
    const decoded = decodeSnapshot(encodeSnapshot(progress([], next), catalog), catalog).next!;
    expect(Math.abs(decoded.lat - next.lat)).toBeLessThan(0.01);
    expect(Math.abs(decoded.lng - next.lng)).toBeLessThan(0.01);
  });

  it('drops ids unknown to the catalog', () => {
    const bytes = encodeSnapshot(progress(['missing', allIds[0]!]), catalog);
    expect(Object.keys(decodeSnapshot(bytes, catalog).found)).toEqual([allIds[0]]);
  });

  it('rejects snapshots from another catalog', () => {
    const other = createSyncCatalog([{ id: '1', area: '', latlng: null }], ['World Map']);
    expect(() => decodeSnapshot(encodeSnapshot(progress([]), other), catalog)).toThrow(CatalogMismatchError);
  });

  it('rejects garbage bytes', () => {
    expect(() => decodeSnapshot(new Uint8Array([1, 2, 3]), catalog)).toThrow(DecodeError);
  });
});

describe('protocol', () => {
  it('keeps an idle poll tiny', () => {
    const request = { rev: Date.now(), knownOtherRev: Date.now(), snapshot: null };
    const bytes = encodeSyncRequest(request);
    expect(decodeSyncRequest(bytes)).toEqual(request);
    expect(bytes.length).toBeLessThanOrEqual(14);
  });

  it('round-trips a response with a snapshot', () => {
    const otherSnapshot = encodeSnapshot(progress(allIds.slice(0, 3)), catalog);
    const response = { storedRev: 5, otherRev: 9, otherSnapshot };
    expect(decodeSyncResponse(encodeSyncResponse(response))).toEqual(response);
  });

  it('rejects another protocol version', () => {
    expect(() => decodeSyncRequest(new Uint8Array([99, 0, 0, 0]))).toThrow(DecodeError);
  });
});
