// Assuming you have already translated minithesis functions and classes to TypeScript
import {
  runTest,
  Unsatisfiable,
  integers,
  bigIntegers,
  toNumber,
  lists,
  Random,
  TestCase,
  MapDB,
  Database,
} from './index'; // Adjust import path as necessary

// import StorageDB from './StorageDB';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {createDataStore} from './DataStoreFactory';
import {IDataStore} from './IDataStore';

const originalConsoleLog = console.log;
let logMock: jest.SpyInstance;

beforeEach(() => {
  // Spy on console.log and keep a reference to the spy
  logMock = jest.spyOn(console, 'log').mockImplementation();
});

afterEach(() => {
  // Restore the original console.log function
  logMock.mockRestore();
});

// Minithesis uses pytest marking and decorators to get the name of the current test.
// in the interest of not changing the code flow too much, we'll pull some evil tricks.

function wrapWithName(
  testFn: (testCase: TestCase) => void
): (testCase: TestCase) => void {
  const currentTestName = expect.getState().currentTestName;
  (testFn as any).testName = currentTestName;
  return testFn;
}

class DBWrapper implements Database {
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

describe('Minithesis Tests', () => {
  test.each(Array.from({length: 10}, (_, i) => i))(
    'finds small list new - seed %i',
    async seed => {
      function sum(arr: number[]): number {
        return arr.reduce((acc, curr) => acc + curr, 0);
      }
      const testFn = wrapWithName((testCase: TestCase) => {
        // Minithesis logic should automatically log the generated values
        const ls = testCase.any(lists(integers(0, 10000)));
        if (sum(ls) > 1000) {
          // Logic to fail the test, expecting minithesis to have logged the value generation
          throw new Error('Assertion failed: sum(ls) <= 1000');
        }
      });

      const random = new Random(seed);
      const database = new MapDB();
      await expect(
        runTest(100, random, database, false)(testFn)
      ).rejects.toThrow('Assertion failed: sum(ls) <= 1000');

      // Verify the log includes the expected message from minithesis logic, not the testFn
      expect(logMock).toHaveBeenCalledWith(
        expect.stringContaining('any(lists(integers(0, 10000))): [1001]')
      );
    }
  );

  test('reduces additive pairs', async () => {
    const random = new Random(1212); // Use appropriate seed if necessary
    const database = new MapDB();

    const testFn = (testCase: TestCase) => {
      const m = testCase.choice(BigInt(1000));
      const n = testCase.choice(BigInt(1000));
      // console.info(`(${m}, ${n})`);
      if (m + n > 1000) {
        // console.log(`choice(1000): ${m}`, `choice(1000): ${n}`);
        throw new Error('Assertion failed: m + n > 1000');
      }
    };

    await expect(
      runTest(10000, random, database, false)(wrapWithName(testFn))
    ).rejects.toThrow('Assertion failed: m + n > 1000');

    expect(logMock).toHaveBeenCalledWith(
      expect.stringContaining('choice(1000): 1')
    );
    expect(logMock).toHaveBeenCalledWith(
      expect.stringContaining('choice(1000): 1000')
    );
  });

  test('test cases satisfy preconditions', () => {
    const testFn = (testCase: TestCase) => {
      const n = toNumber(testCase.choice(BigInt(10)));
      testCase.assume(n !== 0);
      expect(n).not.toBe(0);
    };

    expect(() =>
      runTest(100, new Random(), new MapDB(), false)(testFn)
    ).not.toThrow();
  });

  test('error on too strict precondition', async () => {
    const testFn = (testCase: TestCase) => {
      testCase.choice(BigInt(10));
      testCase.reject(); // This should cause Unsatisfiable to be thrown
    };

    await expect(
      runTest(100, new Random(), new MapDB(), false)(testFn)
    ).rejects.toThrow(Unsatisfiable);
  });
  test('error on unbounded test function', async () => {
    const testFn = (testCase: TestCase) => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        testCase.choice(BigInt(10));
      }
    };

    expect(
      runTest(5, new Random(), new MapDB(), false)(testFn)
    ).rejects.toThrow(Unsatisfiable);
  });

  describe('test reuses results from the database', () => {
    let tempDirPath: string;
    let count = 0;

    beforeAll(() => {
      // Create a temporary directory to act as the database directory
      tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'minithesis-test-'));
    });

    afterAll(() => {
      // Cleanup: Remove the temporary directory after the tests
      fs.rmdirSync(tempDirPath, {recursive: true});
    });

    const run = async () => {
      const db = new DBWrapper(createDataStore<string>(tempDirPath));
      const testFn = (testCase: TestCase) => {
        count += 1;
        const choice = testCase.choice(BigInt(10000));
        if (choice >= BigInt(10)) {
          throw new Error('Choice is too high');
        }
      };

      await expect(
        runTest(100, new Random(), db, false)(wrapWithName(testFn))
      ).rejects.toThrow('Choice is too high');
      return db;
    };

    test('database usage and assertion counts', async () => {
      const firstdb = await run();
      const initialFilesCount = await firstdb.count();
      expect(initialFilesCount).toBe(1);
      const prevCount = count;

      const seconddb = await run();
      const afterFilesCount = await seconddb.count();
      expect(afterFilesCount).toBe(1);
      expect(count).toBe(prevCount + 2);
    });
  });
});
