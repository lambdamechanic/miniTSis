import {TestCase} from '@minitsis/core';
import type {Database} from 'minitsis-datastore';

// In-memory Database implementation used for most core semantics tests
export class MapDB implements Database {
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

export function wrapWithName(
  testFn: (testCase: TestCase) => void
): (testCase: TestCase) => void {
  const currentTestName = expect.getState().currentTestName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (testFn as any).testName = currentTestName;
  return testFn;
}

export function wrapWithNameAsync(
  testFn: (testCase: TestCase) => Promise<void>
): (testCase: TestCase) => Promise<void> {
  const currentTestName = expect.getState().currentTestName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (testFn as any).testName = currentTestName;
  return testFn;
}

export async function usingDatabase(
  factory: () => Promise<{db: Database; cleanup?: () => Promise<void>}>,
  fn: (db: Database) => Promise<void>
): Promise<void> {
  const handle = await factory();
  try {
    await fn(handle.db);
  } finally {
    await handle.cleanup?.();
  }
}
