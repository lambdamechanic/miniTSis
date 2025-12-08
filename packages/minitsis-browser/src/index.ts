import localForage from 'localforage';
import {DBWrapper, Database, IDataStore} from 'minitsis-datastore';

export * from 'minitsis';

// BrowserDataStore.ts
export class BrowserDataStore implements IDataStore<string> {
  constructor(private storeName: string) {
    localForage.config({
      name: this.storeName,
    });
  }

  async set(key: string, value: string): Promise<void> {
    await localForage.setItem(key, value);
  }

  async get(key: string): Promise<string | null> {
    const value = await localForage.getItem<string>(key);
    return value ?? null;
  }

  async delete(key: string): Promise<void> {
    await localForage.removeItem(key);
  }

  async clear(): Promise<void> {
    await localForage.clear();
  }

  async count(): Promise<number> {
    return await localForage.length();
  }
}

export function createBrowserDatabase(storeName: string): Database {
  const store = new BrowserDataStore(storeName);
  return new DBWrapper(store);
}
