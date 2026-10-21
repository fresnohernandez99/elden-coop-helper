/** Thrown when a binary message is malformed. */
export class DecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecodeError';
  }
}

const MAX_VARINT_BYTES = 8; // enough for JS safe integers (2^53)

/** Byte writer that grows as needed. */
export class ByteWriter {
  private buffer = new Uint8Array(64);
  private length = 0;

  u8(value: number): this {
    this.reserve(1);
    this.buffer[this.length++] = value & 0xff;
    return this;
  }

  u16(value: number): this {
    return this.u8(value >>> 8).u8(value);
  }

  u32(value: number): this {
    return this.u8(value >>> 24).u8(value >>> 16).u8(value >>> 8).u8(value);
  }

  /** Variable-length unsigned integer (LEB128): 1 byte when < 128. */
  varint(value: number): this {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`Invalid varint: ${value}`);
    while (value >= 0x80) {
      this.u8((value % 0x80) | 0x80);
      value = Math.floor(value / 0x80);
    }
    return this.u8(value);
  }

  bytes(data: Uint8Array): this {
    this.reserve(data.length);
    this.buffer.set(data, this.length);
    this.length += data.length;
    return this;
  }

  /** Bytes prefixed with their length. */
  sizedBytes(data: Uint8Array): this {
    return this.varint(data.length).bytes(data);
  }

  finish(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }

  private reserve(extra: number) {
    if (this.length + extra <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
  }
}

/** Byte reader that throws DecodeError if the message ends early. */
export class ByteReader {
  private position = 0;

  constructor(private readonly buffer: Uint8Array) {}

  u8(): number {
    const value = this.buffer[this.position];
    if (value === undefined) throw new DecodeError('Truncated message');
    this.position++;
    return value;
  }

  u16(): number {
    return (this.u8() << 8) | this.u8();
  }

  u32(): number {
    return ((this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8()) >>> 0;
  }

  varint(): number {
    let value = 0;
    let multiplier = 1;
    for (let i = 0; i < MAX_VARINT_BYTES; i++) {
      const byte = this.u8();
      value += (byte & 0x7f) * multiplier;
      if (byte < 0x80) return value;
      multiplier *= 0x80;
    }
    throw new DecodeError('Varint too long');
  }

  bytes(length: number): Uint8Array {
    if (this.position + length > this.buffer.length) throw new DecodeError('Truncated message');
    const data = this.buffer.subarray(this.position, this.position + length);
    this.position += length;
    return data;
  }

  sizedBytes(maxLength: number): Uint8Array {
    const length = this.varint();
    if (length > maxLength) throw new DecodeError(`Block too large (${length} bytes)`);
    return this.bytes(length);
  }

  /** Everything not read yet. */
  rest(): Uint8Array {
    return this.bytes(this.buffer.length - this.position);
  }

  expectEnd() {
    if (this.position !== this.buffer.length) throw new DecodeError('Trailing bytes at end of message');
  }
}
