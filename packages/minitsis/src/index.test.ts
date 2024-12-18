import {
  CachedTestFunction,
  DBWrapper,
  Frozen,
  MapDB,
  Random,
  Status,
  type ChoiceMap,
  TestCase,
  TestingState,
  Unsatisfiable,
  bigIntegers,
  integers,
  just,
  lists,
  mixOf,
  nothing,
  runTest,
  runTestAsync,
  sublists,
  toNumber,
  tuples,
  uuids,
  bigintArraysEqual,

  // for debugging only
  // getBufferSize,
  setBufferSize,
} from './index';

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {Database, IDataStore} from 'minitsis-datastore';

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
import {BrowserDataStore} from 'minitsis-browser';
import {NodeDataStore} from 'minitsis-node';

// Function to create a "fake" ChoiceMap that throws when `.get` is called
function createFakeChoiceMap(): ChoiceMap {
  const handler = {
    get(target: any, prop: PropertyKey, receiver: any): any {
      if (prop === 'get') {
        return function () {
          // https://github.com/lambdamechanic/miniTSis/issues/1
          // throw new Error("'.get' method was called on a fake ChoiceMap");
        };
      } else if (prop === 'set') {
        return function (a) {
          return undefined;
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  };

  const fakeMap = new Map<bigint, ChoiceMap | Status>();
  const proxy = new Proxy(fakeMap, handler);
  return proxy as ChoiceMap;
}

function serializeChoiceMap(choiceMap: ChoiceMap): any {
  const obj = {};
  for (const [key, value] of choiceMap) {
    if (value instanceof Map) {
      obj[key.toString()] = serializeChoiceMap(value); // Recursively serialize nested ChoiceMaps
    } else {
      // For enum values, you might want to store them in a distinguishable way
      obj[key.toString()] = value;
    }
  }
  return obj;
}

const _nodejs =
  typeof process !== 'undefined' && process.versions && process.versions.node;

const isBrowser: boolean = _nodejs === undefined;

export function createDataStore<U>(dbPath: string): IDataStore<U> {
  if (isBrowser) {
    // We're in a browser environment
    return new BrowserDataStore<U>(dbPath); // The dbPath is ignored in the browser
  } else {
    // We're in a Node.js environment
    return new NodeDataStore<U>(dbPath);
  }
}

// const originalConsoleLog = console.log;
let logMock: jest.SpyInstance;

beforeEach(() => {
  // set normal buffer size
  setBufferSize(8 * 1024);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (testFn as any).testName = currentTestName;
  return testFn;
}

function wrapWithNameAsync(
  testFn: (testCase: TestCase) => Promise<void>
): (testCase: TestCase) => Promise<void> {
  const currentTestName = expect.getState().currentTestName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (testFn as any).testName = currentTestName;
  return testFn;
}

describe('Minithesis Tests', () => {
  test.each(Array.from({length: 1}, (_, i) => i))(
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

      const database = new MapDB();
      await expect(runTest(100, seed, database, false)(testFn)).rejects.toThrow(
        'Assertion failed: sum(ls) <= 1000'
      );

      // Verify the log includes the expected message from minithesis logic, not the testFn
      expect(logMock).toHaveBeenCalledWith(
        expect.stringContaining('any(lists(integers(0, 10000))): [1001]')
      );
    }
  );

  test('reduces additive pairs', async () => {
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
      runTest(1000, 1234, database, false)(wrapWithName(testFn))
    ).rejects.toThrow('Assertion failed: m + n > 1000');

    expect(logMock).toHaveBeenCalledWith(
      expect.stringContaining('choice(1000): 1')
    );
    expect(logMock).toHaveBeenCalledWith(
      expect.stringContaining('choice(1000): 1000')
    );
  });

  test('test cases satisfy preconditions', async () => {
    const testFn = (testCase: TestCase) => {
      const n = toNumber(testCase.choice(BigInt(5)));
      testCase.assume(n !== 0);
      expect(n).not.toBe(0);
    };

    await expect(runTest(100, 1234, new MapDB(), true)(wrapWithName(testFn)));
  });

  test('error on too strict precondition', async () => {
    const testFn = (testCase: TestCase) => {
      testCase.choice(BigInt(21));
      testCase.reject(); // This should cause Unsatisfiable to be thrown
    };

    await expect(
      runTest(100, 1234, new MapDB(), false)(testFn)
    ).rejects.toThrow(Unsatisfiable);
  });
  test('error on unbounded test function', async () => {
    const testFn = (testCase: TestCase) => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        testCase.choice(BigInt(22));
      }
    };
    setBufferSize(10);

    await expect(runTest(5, 1234, new MapDB(), true)(testFn)).rejects.toThrow(
      Unsatisfiable
    );
  });

  describe('test reuses results from the database', () => {
    let tempDirPath: string;
    let count = 0;

    beforeAll(async () => {
      // Create a temporary directory to act as the database directory
      tempDirPath = await fs.mkdtemp(
        path.join(os.tmpdir(), 'minithesis-test-')
      );
    });

    afterAll(async () => {
      // Cleanup: Remove the temporary directory after the tests
      await fs.rm(tempDirPath, {recursive: true});
    });

    const run = async () => {
      const db = new DBWrapper(createDataStore<string>(tempDirPath + '/db'));
      const testFn = (testCase: TestCase) => {
        count += 1;
        const choice = testCase.choice(BigInt(10000));
        if (choice >= BigInt(8)) {
          throw new Error('Choice is too high');
        }
      };

      await expect(
        runTest(100, 1234, db, false)(wrapWithName(testFn))
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

  test('test_function_cache', async () => {
    const testFn = async (testCase: TestCase) => {
      if (testCase.choice(1000n) >= 200n) {
        testCase.markStatus(Status.INTERESTING);
      }
      if (testCase.choice(1n) === 0n) {
        testCase.reject();
      }
    };

    const random = new Random(0);
    const state = new TestingState(random, wrapWithNameAsync(testFn), 100);
    const cache = new CachedTestFunction(state.testFunction.bind(state));
    expect(state.calls).toBe(0);
    expect(await cache.call([1n, 1n])).toBe(Status.VALID);
    expect(state.calls).toBe(1);
    expect(await cache.call([1n])).toBe(Status.OVERRUN);
    expect(state.calls).toBe(1);
    expect(await cache.call([1000n])).toBe(Status.INTERESTING);
    expect(state.calls).toBe(2);
    expect(await cache.call([1000n])).toBe(Status.INTERESTING);
    expect(state.calls).toBe(2);
    expect(await cache.call([1000n, 1n])).toBe(Status.INTERESTING);

    expect(state.calls).toBe(2);
  });

  test.each(Array.from({length: 100}, (_, i) => i))(
    'finds a local maximum - seed %i',
    async seed => {
      const testFn = wrapWithName((testCase: TestCase) => {
        const m = testCase.choice(1000n);
        const n = testCase.choice(1000n);
        const score = Number(-((m - 500n) ** 2n + (n - 500n) ** 2n));
        testCase.target(score);
        if (m === 500n && n === 500n) {
          throw new Error('Found the local maximum at (500, 500)');
        }
      });

      const database = new MapDB(); // Assuming MapDB is an implementation of Database
      await expect(runTest(200, seed, database, true)(testFn)).rejects.toThrow(
        'Found the local maximum at (500, 500)'
      );
    }
  );

  test('can target a score upwards to interesting', async () => {
    const testFn = wrapWithName((testCase: TestCase) => {
      const n = testCase.choice(1000n);
      const m = testCase.choice(1000n);
      const score = n + m;
      testCase.target(Number(score));
      if (score >= 2000) {
        throw new Error('Score exceeds target');
      }
    });

    await expect(
      runTest(1000, 1234, new MapDB(), false)(testFn)
    ).rejects.toThrow('Score exceeds target');

    expect(logMock).toHaveBeenCalledWith(
      expect.stringContaining('choice(1000): 1000')
    );

    // these _should_ work. we are outputting a bunch of other stuff right now. TODO.
    // Verify that logMock was called exactly twice
    expect(logMock).toHaveBeenCalledTimes(2);

    // Verify that logMock was called with the expected string on the first call
    expect(logMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('choice(1000): 1000')
    );

    // Verify that logMock was called with the expected string on the second call
    expect(logMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('choice(1000): 1000')
    );
  });
  test('can target a score upwards without failing', async () => {
    let maxScore = 0;

    const testFn = wrapWithName((testCase: TestCase) => {
      const n = testCase.choice(1000n);
      const m = testCase.choice(1000n);
      const score = n + m;
      testCase.target(Number(score));
      maxScore = Math.max(Number(score), maxScore);
    });

    await runTest(1000, 1234, new MapDB(), true)(testFn);

    // Verify that maxScore reached the expected value
    expect(maxScore).toBe(2000);
  });

  test('targeting when most do not benefit', async () => {
    const big = BigInt(10000);

    const testFn = wrapWithName((testCase: TestCase) => {
      testCase.choice(BigInt(1000));
      testCase.choice(BigInt(1000));
      const score = testCase.choice(big);
      testCase.target(Number(score)); // Assuming `target` takes a `number`. Adjust if it takes a `bigint` instead.
      if (score >= big) {
        throw new Error(`Score ${score} should be less than ${big}`);
      }
    });

    await expect(
      runTest(1000, 1234, new MapDB(), false)(testFn)
    ).rejects.toThrow('Score 10000 should be less than 10000');

    expect(logMock).toHaveBeenCalledTimes(3);
    expect(logMock).toHaveBeenCalledWith(
      expect.stringContaining('choice(1000): 0')
    );
    await expect(logMock).toHaveBeenCalledWith(
      expect.stringContaining('choice(10000): 10000')
    );
  });

  test.each(Array.from({length: 10}, (_, i) => i))(
    'can target a score downwards - seed %i',
    async seed => {
      // logMock.mockRestore();
      const testFn = async (testCase: TestCase) => {
        const n = testCase.choice(1000n);
        const m = testCase.choice(1000n);
        const score = n + m;
        // console.warn("score1", score);
        await testCase.target(Number(-score)); // Assuming `target` method expects a number. Adjust if it accepts bigint.
        // console.warn("score", score);
        if (score <= 0) {
          throw new Error(
            `Assertion failed: score (${score}) should be greater than 0`
          );
        }
      };

      await expect(
        runTestAsync(1000, seed, new MapDB(), false)(wrapWithNameAsync(testFn))
      ).rejects.toThrow('Assertion failed: score (0) should be greater than 0');

      // Verify the log includes the expected message
      await expect(logMock).toHaveBeenCalledWith(
        expect.stringContaining('choice(1000): 0')
      );

      expect(logMock).toHaveBeenCalledTimes(2); // Assuming there's a known bug that causes logs to be duplicated
    }
  );

  test('prints a top level weighted', async () => {
    const testFn = (testCase: TestCase) => {
      if (testCase.weighted(0.5) === false) {
        throw new Error('Assertion failed: weighted(0.5) should be true');
      }
    };

    await expect(
      runTest(1000, 1234, new MapDB(), false)(wrapWithName(testFn))
    ).rejects.toThrow('Assertion failed: weighted(0.5) should be true');

    //    Verify the log includes the expected message
    expect(logMock).toHaveBeenCalledWith(
      expect.stringContaining('weighted(0.5): false')
    );
    expect(logMock).toHaveBeenCalledTimes(1); // Assuming there's a known bug that causes logs to be duplicated
  });

  test('errors when using frozen', async () => {
    const tc = TestCase.forChoices([0n]);
    tc.status = Status.VALID;

    // Using Jest's expect to assert that calling markStatus on a frozen TestCase throws Frozen
    expect(() => tc.markStatus(Status.INTERESTING)).toThrow(Frozen);

    // Using Jest's expect to assert that calling choice on a frozen TestCase throws Frozen
    expect(() => tc.choice(11n)).toThrow(Frozen);

    // Using Jest's expect to assert that calling forcedChoice on a frozen TestCase throws Frozen
    expect(() => tc.forcedChoice(12n)).toThrow(Frozen);
  });

  // this doesn't actually error, because we are using bigints.
  xtest('errors on too large choice', async () => {
    const tc = TestCase.forChoices([0n]);
    const testFn = wrapWithName((tc: TestCase) => {
      tc.choice(BigInt(2) ** BigInt(64));
    });
    expect(() => testFn(tc)).toThrow(Error);
  });

  test('can choose full 64 bits', async () => {
    const testFn = wrapWithName((tc: TestCase) => {
      tc.choice(BigInt(2) ** BigInt(64) - BigInt(1));
    });
    await runTest(100, 1234, new MapDB(), true)(testFn);
  });

  test('uuids are different', async () => {
    const testFn = (tc: TestCase) => {
      const a = tc.any(uuids());
      const b = tc.any(uuids());
      if (a === b) {
        throw new Error('non unique identifiers!');
      }
    };
    await runTest(100, 1234, new MapDB(), true)(wrapWithName(testFn));
  });
  test('can draw mixture', async () => {
    const testFn = wrapWithName((tc: TestCase) => {
      const m = tc.any(mixOf(bigIntegers(-5n, 0n), bigIntegers(2n, 5n)));
      expect(Number(m)).toBeGreaterThanOrEqual(-5);
      expect(Number(m)).toBeLessThanOrEqual(5);
      expect(Number(m)).not.toBe(1);
    });
    await runTest(100, 1234, new MapDB(), true)(testFn);
  });

  test('mapped possibility', async () => {
    const testFn = wrapWithName((tc: TestCase) => {
      const n = tc.any(bigIntegers(0n, 5n).map((n: bigint) => n * 2n));
      expect(n % 2n).toBe(0n);
    });
    await runTest(100, 1234, new MapDB(), true)(testFn);
  });

  test('selected possibility', async () => {
    const testFn = wrapWithName((tc: TestCase) => {
      const n = tc.any(
        bigIntegers(0n, 5n).satisfying((n: bigint) => n % 2n === 0n)
      );
      if (n % 2n !== 0n) {
        throw 'Bad odd number!';
      }
    });
    await runTest(100, 1234, new MapDB(), true)(testFn);
  });

  test('bound possibility', async () => {
    const testFn = wrapWithName((tc: TestCase) => {
      const [m, n] = tc.any(
        bigIntegers(0n, 5n).bind((m: bigint) =>
          tuples(just(m), bigIntegers(m, m + 10n))
        )
      );
      expect(m <= n && n <= m + 10n).toBe(true);
    });
    await runTest(100, 1234, new MapDB(), true)(testFn);
  });

  test('cannot witness nothing', async () => {
    const testFn = wrapWithName((tc: TestCase) => {
      tc.any(nothing());
    });
    await expect(runTest(100, 1234, new MapDB(), true)(testFn)).rejects.toThrow(
      Unsatisfiable
    );
  });

  test('cannot witness empty mix of', async () => {
    const testFn = wrapWithName((tc: TestCase) => {
      tc.any(mixOf());
    });
    await expect(runTest(100, 1234, new MapDB(), true)(testFn)).rejects.toThrow(
      Unsatisfiable
    );
  });

  test('target and reduce', async () => {
    const testFn = (tc: TestCase) => {
      const m = tc.choice(100000n);
      tc.target(Number(m));
      if (m > 99900n) {
        throw new Error('Assertion failed: m <= 99900');
      }
    };

    await expect(
      runTest(100, 1234, new MapDB(), false)(wrapWithName(testFn))
    ).rejects.toThrow('Assertion failed: m <= 99900');
    expect(logMock).toHaveBeenCalledWith(
      expect.stringContaining('choice(100000): 99901')
    );
  });

  test('impossible weighted', async () => {
    const testFn = (tc: TestCase) => {
      tc.choice(1n);
      for (let i = 0; i < 10; i++) {
        if (tc.weighted(0.0)) {
          throw new Error('Failure in weighted(0.0)');
        }
      }
      const s = tc.choice(1n);
      if (s !== 0n) {
        throw new Error('Failure in choice(1)');
      }
    };
    await expect(
      runTest(100, 1234, new MapDB(), false)(wrapWithName(testFn))
    ).rejects.toThrow('Failure in choice(1)');
  });

  test('lists get shrunk eventually', async () => {
    const testFn = (tc: TestCase) => {
      // intent is to see if we can properly shrink the original list down.
      const m = tc.any(
        lists(integers(0, 100))
          .bind(n => lists(integers(0, 40)).map(o => [...o, ...n, ...o]))
          .bind(p => lists(integers(0, 40)).map(o => [...o, ...p, ...o]))
      );

      if (m.includes(93)) {
        throw new Error(`Failure: length (${m.length})`);
      }
    };
    await expect(
      runTest(1000, 1234, new MapDB(), false)(wrapWithName(testFn))
    ).rejects.toThrow('Failure: length (1)');
  });
  function wrapWithNameAsync(
    testFn: (testCase: TestCase) => Promise<void>
  ): (testCase: TestCase) => Promise<void> {
    // const currentTestName = expect.getState().currentTestName;
    const currentTestName = 'hardcodedOracleTest';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testFn as any).testName = currentTestName;
    return testFn;
  }

  test('runTestAsync throws when database is not provided', async () => {
    const testFn = wrapWithNameAsync(async (tc: TestCase) => {
      tc.any(integers(1, 2));
    });
    await expect(
      runTestAsync(100, 1234)(testFn)
    ).rejects.toThrow('need a db');
  });

  test('alertOnFailure is called', async () => {
    const testFn = wrapWithNameAsync(async (tc: TestCase) => {
      const m = tc.any(integers(1, 2));
      throw new Error('always fail');
    });
    await expect(
      runTestAsync(100, 1234, new MapDB(), false, async testCase => {
        throw new Error('QUITTING MESSILY');
      })(testFn)
    ).rejects.toThrow('QUITTING MESSILY');
  });

  test('integers respects minimum', async () => {
    const testFn = async (tc: TestCase) => {
      const n = tc.any(integers(1, 50));
      const m = tc.any(integers(n, 100));
      if (m < n) {
        throw new Error('Failure in integers(1, 100)');
      }
    };
    await expect(
      await runTestAsync(
        10000,
        1234,
        new MapDB(),
        false
      )(wrapWithNameAsync(testFn))
    );
  });

  test('guaranteed weighted', async () => {
    const testFn = wrapWithName((tc: TestCase) => {
      if (tc.weighted(1.0)) {
        tc.choice(1n);
        throw new Error('Failure');
      } else {
        throw new Error('Assertion failed');
      }
    });
    await expect(
      runTest(100, 1234, new MapDB(), false)(testFn)
    ).rejects.toThrow('Failure');
  });

  test('size bounds on list', async () => {
    const testFn = wrapWithName((tc: TestCase) => {
      const ls = tc.any(lists(bigIntegers(0n, 17n), 1, 3));
      expect(ls.length).toBeGreaterThanOrEqual(1);
      expect(ls.length).toBeLessThanOrEqual(3);
    });
    await runTest(100, 1234, new MapDB(), false)(testFn);
  });

  test('toNumber throws on out of bounds values', () => {
    // Test too high
    expect(() => toNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(
      'BigInt value is too large to be safely converted to a Number'
    );
    
    // Test too low
    expect(() => toNumber(BigInt(Number.MIN_SAFE_INTEGER) - 1n)).toThrow(
      'BigInt value is too low to be safely converted to a Number'
    );
  });

  test('TestCase throws on negative choice argument', () => {
    const tc = new TestCase([], new Random(1234), Infinity);
    expect(() => tc.choice(-1n)).toThrow('Invalid choice -1');
  });

  test('randBigInt validation', () => {
    const random = new Random(1234);
    // Test max < min
    expect(() => random.randBigInt(10n, 5n)).toThrow('min must be less than or equal to max');
    // Test equal values works fine
    expect(() => random.randBigInt(5n, 5n)).not.toThrow();
    expect(random.randBigInt(5n, 5n)).toBe(5n);
  });

  test('randRange generates numbers within bounds', () => {
    const random = new Random(1234);
    const min = 5;
    const max = 10;
    for (let i = 0; i < 100; i++) {
      const result = random.randRange(min, max);
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThan(max);
    }
  });

  test('bigintArraysEqual comparison', () => {
    // Test equal arrays
    expect(bigintArraysEqual([1n, 2n, 3n], [1n, 2n, 3n])).toBe(true);
    // Test different lengths
    expect(bigintArraysEqual([1n, 2n], [1n, 2n, 3n])).toBe(false);
    // Test different values
    expect(bigintArraysEqual([1n, 2n, 3n], [1n, 2n, 4n])).toBe(false);
    // Test undefined arrays
    expect(bigintArraysEqual(undefined, [1n])).toBe(false);
    expect(bigintArraysEqual([1n], undefined)).toBe(false);
    expect(bigintArraysEqual(undefined, undefined)).toBe(false);
  });

  test('smallerThan comparison', () => {
    // Test first array longer than second
    expect(smallerThan([1n, 2n, 3n], [1n, 2n])).toBe(false);
    // Test arrays of same length and content
    expect(smallerThan([1n, 2n, 3n], [1n, 2n, 3n])).toBe(false);
    // Test first array smaller than second
    expect(smallerThan([1n, 2n], [1n, 2n, 3n])).toBe(true);
  });

  test('forced choice bounds', async () => {
    const tc = new TestCase([], new Random(1234), Infinity);
    expect(() => tc.forcedChoice(2n ** 64n)).toThrowError();
  });
  test('failure from hypothesis 1', async () => {
    const testFn = wrapWithName((tc: TestCase) => {
      const n1 = tc.weighted(0.0);
      if (!n1) {
        const n2 = tc.choice(511n);
        if (n2 === 112n) {
          const n3 = tc.choice(511n);
          if (n3 === 124n || n3 === 93n) {
            throw new Error('Failure');
          } else {
            tc.markStatus(Status.INVALID);
          }
        } else if (n2 === 93n) {
          throw new Error('Failure');
        } else {
          tc.markStatus(Status.INVALID);
        }
      }
    });
    await expect(
      runTest(1000, 1234, new MapDB(), true)(testFn)
    ).rejects.toThrow('Failure');
  });

  test('failure from hypothesis 2', async () => {
    const testFn = (tc: TestCase) => {
      const n1 = tc.choice(6n);
      if (n1 === 6n) {
        const n2 = tc.weighted(0.0);
        if (!n2) {
          throw new Error('Failure');
        }
      } else if (n1 === 4n) {
        const n3 = tc.choice(0n); // Correctly representing tc.choice(0) as a valid case
        if (n3 === 0n) {
          throw new Error('Failure');
        } else {
          tc.markStatus(Status.INVALID);
        }
      } else if (n1 === 2n) {
        throw new Error('Failure');
      } else {
        tc.markStatus(Status.INVALID);
      }
    };
    await expect(
      runTest(1000, 1234, new MapDB(), true)(wrapWithName(testFn))
    ).rejects.toThrow('Failure');
  });

  test('test bound possibility subset', async () => {
    const testFn = (testCase: TestCase) => {
      const m = testCase.any(lists(integers(0, 100)).bind(m => sublists(m)));
      const broken = m.includes(7) && m.includes(1);
      if (broken) {
        throw new Error(`broken combination: ${m}`);
      }
    };

    const random = 1234;
    const database = new MapDB(); // Assuming MapDB is a suitable in-memory database or similar setup

    await expect(
      runTest(5000, random, database, false)(wrapWithName(testFn))
    ).rejects.toThrow(/broken combination: (1,7|7,1)/);
  });

  // derived from bad shrink at https://github.com/dubzzz/fast-check/issues/650#issuecomment-648397230
  test('shrinking regression in fast-check', async () => {
    const testFn = (testCase: TestCase) => {
      const [a, b] = testCase.any(
        integers(0, 100).bind(b => tuples(integers(0, b), just(b)))
      );

      // The predicate that will fail if 'a' and 'b' are not close enough
      if (b - a > 5n) {
        throw new Error(`Predicate failed: b (${b}) - a (${a}) > 5`);
      }
    };

    await expect(
      runTest(100, 1234, new MapDB(), false)(wrapWithName(testFn))
    ).rejects.toThrow('Predicate failed: b (6) - a (0) > 5');
  });
});
