import {BrowserDataStore, createBrowserDatabase} from '../src';

const getEncoder = () =>
  typeof TextEncoder !== 'undefined'
    ? new TextEncoder()
    : new (require('util').TextEncoder)();

const getDecoder = () =>
  typeof TextDecoder !== 'undefined'
    ? new TextDecoder()
    : new (require('util').TextDecoder)();

const toBytes = (s: string) => getEncoder().encode(s);
const fromBytes = (b: Uint8Array | null) =>
  b ? getDecoder().decode(b) : null;

describe('browser adapter integration', () => {
  test('round-trips strings and clears', async () => {
    const db = createBrowserDatabase('minitsis-test-strings');
    await db.set('hello', toBytes('world'));
    const loaded = await db.get('hello');
    expect(fromBytes(loaded)).toBe('world');
    expect(await db.count()).toBe(1);
    await db.delete('hello');
    expect(await db.count()).toBe(0);
  });

  test('round-trips objects via JSON serialization', async () => {
    const db = createBrowserDatabase('minitsis-test-objects');
    const payload = {a: 1, b: 'two', c: [3, 4]};
    await db.set('obj', toBytes(JSON.stringify(payload)));
    const loaded = await db.get('obj');
    expect(JSON.parse(fromBytes(loaded) || '')).toEqual(payload);
  });

  test('isolates localforage state across datastore instances', async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const storeA = new BrowserDataStore(`minitsis-test-isolated-a-${suffix}`);
    const storeB = new BrowserDataStore(`minitsis-test-isolated-b-${suffix}`);

    await storeA.set('a', 'value-a');
    await storeB.set('b', 'value-b');

    expect(await storeA.get('a')).toBe('value-a');
    expect(await storeB.get('b')).toBe('value-b');
    expect(await storeA.count()).toBe(1);
    expect(await storeB.count()).toBe(1);

    await storeA.clear();

    expect(await storeA.count()).toBe(0);
    expect(await storeB.count()).toBe(1);
    expect(await storeB.get('b')).toBe('value-b');

    await storeB.clear();
  });
});
