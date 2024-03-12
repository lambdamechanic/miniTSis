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
