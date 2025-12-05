// Interface definition
export interface IDataStore<U> {
  set(key: string, value: U): Promise<void>;
  get(key: string): Promise<U | null>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface Database {
  set(key: string, value: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  count?(): Promise<number>;
}

function hasNodeBuffer(): boolean {
  return typeof Buffer !== 'undefined';
}

function encodeBase64(data: Uint8Array): string {
  if (hasNodeBuffer()) {
    return Buffer.from(data).toString('base64');
  }

  if (typeof globalThis === 'object' && 'btoa' in globalThis) {
    // btoa expects a binary string, so construct one in small chunks to avoid stack issues
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return (globalThis as unknown as {btoa(data: string): string}).btoa(binary);
  }

  throw new Error('No base64 encoder available in the current environment.');
}

function decodeBase64(encoded: string): Uint8Array {
  if (hasNodeBuffer()) {
    return Uint8Array.from(Buffer.from(encoded, 'base64'));
  }

  if (typeof globalThis === 'object' && 'atob' in globalThis) {
    const binary = (globalThis as unknown as {atob(data: string): string}).atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  throw new Error('No base64 decoder available in the current environment.');
}

export function toBase64(data: Uint8Array): string {
  return encodeBase64(data);
}

export function fromBase64(encoded: string): Uint8Array {
  return decodeBase64(encoded);
}

// Utility wrapper that adapts an IDataStore storing strings into the Database interface
// used by minitsis. Values are base64-encoded so we can transport Uint8Arrays.
export class DBWrapper implements Database {
  constructor(private readonly dataStore: IDataStore<string>) {}

  async set(key: string, value: Uint8Array): Promise<void> {
    const base64Value = toBase64(value);
    await this.dataStore.set(key, base64Value);
  }

  async get(key: string): Promise<Uint8Array | null> {
    const base64Value = await this.dataStore.get(key);
    return base64Value ? fromBase64(base64Value) : null;
  }

  async delete(key: string): Promise<void> {
    await this.dataStore.delete(key);
  }

  async count(): Promise<number> {
    if (!this.dataStore.count) {
      throw new Error('Underlying data store does not implement count().');
    }
    return this.dataStore.count();
  }
}
