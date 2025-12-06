import {
  CachedTestFunction,
  Frozen,
  Random,
  Status,
  StopTest,
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
  oneOf,
  runTest,
  runTestAsync,
  sublists,
  toNumber,
  tuples,
  uuids,
  bigintArraysEqual,
  smallerThan,
  setBufferSize,
} from '@minitsis/core';
import type {Database} from 'minitsis-datastore';

export interface DatabaseHandle {
  db: Database;
  cleanup?: () => Promise<void>;
}

export interface MinitsisTestAdapter {
  name: string;
  makeDatabase: () => Promise<DatabaseHandle>;
  makePersistentDatabase?: () => Promise<DatabaseHandle>;
}

// In-memory Database implementation used for most core semantics tests
class MapDB implements Database {
  private data: Map<string, Uint8Array> = new Map();

  async set(key: string, value: Uint8Array): Promise<void> {
    this.data.set(key, value);
  }

  async get(key: string): Promise<Uint8Array | null> {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async count(): Promise<number> {
    return this.data.size;
  }
}

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

async function usingDatabase(
  factory: () => Promise<DatabaseHandle>,
  fn: (db: Database) => Promise<void>
): Promise<void> {
  const handle = await factory();
  try {
    await fn(handle.db);
  } finally {
    await handle.cleanup?.();
  }
}

export function runCommonMinitsisTests(adapter: MinitsisTestAdapter): void {
  describe(`Minitsis Tests (${adapter.name})`, () => {
    let logMock: jest.SpyInstance;

    beforeEach(() => {
      setBufferSize(8 * 1024);
      logMock = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      logMock.mockRestore();
    });

    test.each(Array.from({length: 1}, (_, i) => i))(
      'finds small list new - seed %i',
      async seed => {
        function sum(arr: number[]): number {
          return arr.reduce((acc, curr) => acc + curr, 0);
        }
        const testFn = wrapWithName((testCase: TestCase) => {
          const ls = testCase.any(lists(integers(0, 10000)));
          if (sum(ls) > 1000) {
            throw new Error('Assertion failed: sum(ls) <= 1000');
          }
        });

        const database = new MapDB();
        await expect(
          runTest(100, seed, database, false)(testFn)
        ).rejects.toThrow('Assertion failed: sum(ls) <= 1000');

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
        if (m + n > 1000) {
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
        testCase.reject();
      };

      await expect(
        runTest(100, 1234, new MapDB(), false)(testFn)
      ).rejects.toThrow(Unsatisfiable);
    });

    test('error on unbounded test function', async () => {
      const testFn = (testCase: TestCase) => {
        while (true) {
          testCase.choice(BigInt(22));
        }
      };
      setBufferSize(10);

      await expect(
        runTest(5, 1234, new MapDB(), true)(testFn)
      ).rejects.toThrow(Unsatisfiable);
    });

    describe('persistence via adapter database', () => {
      const countMarker = {value: 0};

      const runWithAdapter = async (): Promise<{dbCount: number}> => {
        await usingDatabase(adapter.makePersistentDatabase || adapter.makeDatabase, async db => {
          const testFn = (testCase: TestCase) => {
            countMarker.value += 1;
            const choice = testCase.choice(BigInt(10000));
            if (choice >= BigInt(8)) {
              throw new Error('Choice is too high');
            }
          };

          await expect(
            runTest(100, 1234, db, false)(wrapWithName(testFn))
          ).rejects.toThrow('Choice is too high');
        });

        const handle = await adapter.makePersistentDatabase?.();
        if (!handle) {
          return {dbCount: 0};
        }
        const count = await handle.db.count();
        await handle.cleanup?.();
        return {dbCount: count};
      };

      test('reuses stored failing example', async () => {
        if (!adapter.makePersistentDatabase) {
          test.skip('adapter does not support persistence');
          return;
        }

        const first = await adapter.makePersistentDatabase();
        try {
          const testFn = (testCase: TestCase) => {
            countMarker.value += 1;
            const choice = testCase.choice(BigInt(10000));
            if (choice >= BigInt(8)) {
              throw new Error('Choice is too high');
            }
          };

          await expect(
            runTest(100, 1234, first.db, false)(wrapWithName(testFn))
          ).rejects.toThrow('Choice is too high');

          const initialCount = await first.db.count();
          const prev = countMarker.value;

          await expect(
            runTest(100, 1234, first.db, false)(wrapWithName(testFn))
          ).rejects.toThrow('Choice is too high');

          const afterCount = await first.db.count();
          expect(initialCount).toBeGreaterThanOrEqual(1);
          expect(afterCount).toBe(initialCount);
          expect(countMarker.value).toBe(prev + 2);
        } finally {
          await first.cleanup?.();
        }
      });

      test('adapter database reachable', async () => {
        await runWithAdapter();
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

        const database = new MapDB();
        await expect(
          runTest(200, seed, database, true)(testFn)
        ).rejects.toThrow('Found the local maximum at (500, 500)');
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
      expect(logMock).toHaveBeenCalledTimes(2);
      expect(logMock).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('choice(1000): 1000')
      );
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
      expect(maxScore).toBe(2000);
    });

    test('targeting when most do not benefit', async () => {
      const big = BigInt(10000);

      const testFn = wrapWithName((testCase: TestCase) => {
        testCase.choice(BigInt(1000));
        testCase.choice(BigInt(1000));
        const score = testCase.choice(big);
        testCase.target(Number(score));
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
        const testFn = async (testCase: TestCase) => {
          const n = testCase.choice(1000n);
          const m = testCase.choice(1000n);
          const score = n + m;
          await testCase.target(Number(-score));
          if (score <= 0) {
            throw new Error(
              `Assertion failed: score (${score}) should be greater than 0`
            );
          }
        };

        await expect(
          runTestAsync(1000, seed, new MapDB(), false)(
            wrapWithNameAsync(testFn)
          )
        ).rejects.toThrow('Assertion failed: score (0) should be greater than 0');

        await expect(logMock).toHaveBeenCalledWith(
          expect.stringContaining('choice(1000): 0')
        );

        expect(logMock).toHaveBeenCalledTimes(2);
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

      expect(logMock).toHaveBeenCalledWith(
        expect.stringContaining('weighted(0.5): false')
      );
      expect(logMock).toHaveBeenCalledTimes(1);
    });

    test('errors when using frozen', () => {
      const tc = TestCase.forChoices([0n]);
      tc.status = Status.VALID;

      expect(() => tc.markStatus(Status.INTERESTING)).toThrow(Frozen);
      expect(() => tc.choice(11n)).toThrow(Frozen);
      expect(() => tc.forcedChoice(12n)).toThrow(Frozen);
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

    test('selects from static list', () => {
      const tc = TestCase.forChoices([1n]);
      const letter = tc.any(oneOf(['a', 'b', 'c'] as const));
      expect(letter).toBe('b');
    });

    test('rejects empty static list', async () => {
      const testFn = wrapWithName((tc: TestCase) => {
        tc.any(oneOf([] as const));
      });

      await expect(
        runTest(10, 42, new MapDB(), true)(testFn)
      ).rejects.toThrow(Unsatisfiable);
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
      await expect(
        runTest(100, 1234, new MapDB(), true)(testFn)
      ).rejects.toThrow(Unsatisfiable);
    });

    test('cannot witness empty mix of', async () => {
      const testFn = wrapWithName((tc: TestCase) => {
        tc.any(mixOf());
      });
      await expect(
        runTest(100, 1234, new MapDB(), true)(testFn)
      ).rejects.toThrow(Unsatisfiable);
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

    test('runTestAsync throws when database is not provided', async () => {
      const asyncNameWrapper = (testFn: (testCase: TestCase) => Promise<void>) => {
        const currentTestName = 'hardcodedOracleTest';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (testFn as any).testName = currentTestName;
        return testFn;
      };

      const testFn = asyncNameWrapper(async (tc: TestCase) => {
        tc.any(integers(1, 2));
      });
      await expect(runTestAsync(100, 1234)(testFn)).rejects.toThrow('need a db');
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
        await runTestAsync(10000, 1234, new MapDB(), false)(
          wrapWithNameAsync(testFn)
        )
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
      expect(() => toNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(
        'BigInt value is too large to be safely converted to a Number'
      );

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
      expect(() => random.randBigInt(10n, 5n)).toThrow(
        'min must be less than or equal to max'
      );
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
      expect(bigintArraysEqual([1n, 2n, 3n], [1n, 2n, 3n])).toBe(true);
      expect(bigintArraysEqual([1n, 2n], [1n, 2n, 3n])).toBe(false);
      expect(bigintArraysEqual([1n, 2n, 3n], [1n, 2n, 4n])).toBe(false);
      expect(bigintArraysEqual(undefined, [1n])).toBe(false);
      expect(bigintArraysEqual([1n], undefined)).toBe(false);
      expect(bigintArraysEqual(undefined, undefined)).toBe(false);
    });

    test('smallerThan comparison', () => {
      expect(smallerThan([1n, 2n, 3n], [1n, 2n])).toBe(false);
      expect(smallerThan([1n, 2n, 3n], [1n, 2n, 3n])).toBe(false);
      expect(smallerThan([1n, 2n], [1n, 2n, 3n])).toBe(true);
    });

    test('forced choice bounds', () => {
      const tc = new TestCase([], new Random(1234), Infinity);
      expect(() => tc.forcedChoice(2n ** 64n)).toThrowError();
    });

    test('TestCase defaults maxSize to Infinity when not specified', () => {
      const random = new Random(12345);
      const testCase = new TestCase([1n, 2n], random);
      expect(testCase.maxSize).toBe(Infinity);
    });

    test('TestCase toString outputs expected format', () => {
      const random = new Random(12345);
      const testCase = new TestCase([1n, 2n], random, 100, true);
      testCase.choices = [3n, 4n];
      testCase.status = Status.VALID;
      testCase.depth = 1;
      testCase.targetingScore = 0.5;

      const expected = `TestCase {
prefix: [1, 2],
random: Random { seed: 12345 },
maxSize: 100,
choices: [3, 4],
status: VALID,
printResults: true,
depth: 1,
targetingScore: 0.5
}`;

      expect(testCase.toString()).toBe(expected);
    });

    test('runTestAsync defaults maxExamples to 100', async () => {
      const testFn = wrapWithNameAsync(async (testCase: TestCase) => {
        const n = testCase.choice(10n);
        if (n > 5n) {
          throw new Error('Found interesting case');
        }
      });

      await expect(
        runTestAsync(100, 1234, new MapDB())(testFn)
      ).rejects.toThrow('Found interesting case');
    });
  });
}
