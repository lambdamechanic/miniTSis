import * as localForage from 'localforage';
import {IDataStore} from 'minitsis-datastore';

// BrowserDataStore.ts
export class BrowserDataStore<U> implements IDataStore<U> {
  constructor(private storeName: string) {
    localForage.config({
      name: this.storeName,
    });
  }

  async set(key: string, value: U): Promise<void> {
    await localForage.setItem(key, value);
  }

  async get(key: string): Promise<U | null> {
    const value = await localForage.getItem<U>(key);
    return value ?? null;
  }

  async delete(key: string): Promise<void> {
    await localForage.removeItem(key);
  }

  async clear(): Promise<void> {
    await localForage.clear();
  }

  async count(): Promise<number> {
    return 0; // todo
  }
}
