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
}

export class DBWrapper implements Database {
  private dataStore: IDataStore<string>;

  constructor(dataStore: IDataStore<string>) {
    this.dataStore = dataStore;
  }

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
    return await this.dataStore.count();
  }
}
function toBase64(arrayBuffer: Uint8Array): string {
  return Buffer.from(arrayBuffer).toString('base64');
}

function fromBase64(base64String: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64String, 'base64'));
}
