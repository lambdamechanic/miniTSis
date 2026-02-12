import localForage from 'localforage';
import {DBWrapper, Database, IDataStore} from 'minitsis-datastore';

export * from 'minitsis';

// BrowserDataStore.ts
export class BrowserDataStore implements IDataStore<string> {
  private readonly store: typeof localForage;

  constructor(private storeName: string) {
    this.store = localForage.createInstance({
      name: this.storeName,
    });
  }

  async set(key: string, value: string): Promise<void> {
    await this.store.setItem(key, value);
  }

  async get(key: string): Promise<string | null> {
    const value = await this.store.getItem<string>(key);
    return value ?? null;
  }

  async delete(key: string): Promise<void> {
    await this.store.removeItem(key);
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }

  async count(): Promise<number> {
    return await this.store.length();
  }
}

export function createBrowserDatabase(storeName: string): Database {
  const store = new BrowserDataStore(storeName);
  return new DBWrapper(store);
}
