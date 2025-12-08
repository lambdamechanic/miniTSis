import {TextDecoder, TextEncoder} from 'util';
import {createBrowserDatabase} from '../src';

const toBytes = (s: string) => new TextEncoder().encode(s);
const fromBytes = (b: Uint8Array | null) =>
  b ? new TextDecoder().decode(b) : null;

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
