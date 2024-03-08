// Assuming storageUtil.ts exports a configured instance of localForage or a similar abstraction
import storage from './storageUtil';

class StorageDB {
  private db: typeof storage;

  constructor() {
    this.db = storage; // Assign the imported storage utility instance
  }

  async setItem(key: string, value: any): Promise<void> {
    try {
      await this.db.setItem(key, value);
      console.log(`Item set: ${key}`);
    } catch (error) {
      console.error(`Error setting item: ${error}`);
    }
  }

  async getItem(key: string): Promise<any> {
    try {
      const value = await this.db.getItem(key);
      console.log(`Item retrieved: ${key}`, value);
      return value;
    } catch (error) {
      console.error(`Error getting item: ${error}`);
      return null;
    }
  }

  async deleteItem(key: string): Promise<void> {
    try {
      await this.db.removeItem(key);
      console.log(`Item removed: ${key}`);
    } catch (error) {
      console.error(`Error removing item: ${error}`);
    }
  }
}

export default StorageDB;
