import {runTest, TestCase} from './index';
import {NodeDataStore} from '../minitsis-node/src';
import {Database} from 'minitsis-datastore';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

function wrapWithName(testFn: (testCase: TestCase) => void) {
  const name = expect.getState().currentTestName;
  (testFn as any).testName = name;
  return testFn;
}

class DBWrapper implements Database {
  constructor(private store: NodeDataStore<string>) {}
  async set(key: string, value: Uint8Array) {
    const encoded = Buffer.from(value).toString('base64');
    await this.store.set(key, encoded);
  }
  async get(key: string) {
    const encoded = await this.store.get(key);
    return encoded ? Uint8Array.from(Buffer.from(encoded, 'base64')) : null;
  }
  async delete(key: string) {
    await this.store.delete(key);
  }
  async count() {
    return this.store.count();
  }
}

describe('NodeDataStore integration', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'minitsis-node-'));
  });
  afterEach(async () => {
    await fs.rm(tmpDir, {recursive: true});
  });

  test('persists failing cases across runs', async () => {
    let calls = 0;
    const run = async () => {
      const store = new DBWrapper(new NodeDataStore<string>(path.join(tmpDir, 'db')));
      const testFn = (tc: TestCase) => {
        calls += 1;
        const n = tc.choice(10n);
        if (n > 3n) throw new Error('boom');
      };
      await expect(runTest(20, 1234, store, false)(wrapWithName(testFn))).rejects.toThrow('boom');
      return store;
    };

    const first = await run();
    const count1 = await first.count();
    expect(count1).toBe(1);
    const prevCalls = calls;

    const second = await run();
    const count2 = await second.count();
    expect(count2).toBe(1);
    expect(calls).toBe(prevCalls + 2);
  });
});
