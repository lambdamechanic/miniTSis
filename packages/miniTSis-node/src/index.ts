import Datastore from 'nedb-promises';
import {IDataStore} from 'miniTSis-datastore';

export class NodeDataStore<U> implements IDataStore<U> {
  private db: Datastore<U>;

  constructor(private dbName: string) {
    this.db = Datastore.create({filename: `${dbName}.db`, autoload: true});
  }

  async set(key: string, value: U): Promise<void> {
    // Directly set the value for the key under a "val" field, using upsert to insert if the key doesn't exist
    await this.db.update({_id: key}, {_id: key, val: value}, {upsert: true});
  }
  async get(key: string): Promise<U | null> {
    const doc = await this.db.findOne<{_id: string; val: U}>({_id: key});
    return doc ? doc.val : null;
  }

  async delete(key: string): Promise<void> {
    await this.db.remove({_id: key}, {});
  }

  async clear(): Promise<void> {
    await this.db.remove({}, {multi: true});
  }

  async count(): Promise<number> {
    const count = await this.db.count({});
    return count;
  }
}
