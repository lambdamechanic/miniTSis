 // Interface definition
export interface IDataStore<U> {
  set(key: string, value: U): Promise<void>;
  get(key: string): Promise<U | null>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}
