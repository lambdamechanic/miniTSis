import {createBrowserDatabase} from '../src';

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
});
