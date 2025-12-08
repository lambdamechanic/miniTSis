import {runTest, TestCase} from '@minitsis/core';
import {usingDatabase, wrapWithName} from './helpers';
import type {MinitsisTestAdapter} from './index';

export function addPersistenceTests(adapter: MinitsisTestAdapter): void {
  describe('persistence via adapter database', () => {
    const countMarker = {value: 0};

    const runWithAdapter = async (): Promise<{dbCount: number}> => {
      await usingDatabase(
        adapter.makePersistentDatabase || adapter.makeDatabase,
        async db => {
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
        }
      );

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
}
