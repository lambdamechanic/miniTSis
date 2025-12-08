import {TextDecoder, TextEncoder} from 'util';
import {createBrowserDatabase} from '../src';

const toBytes = (s: string) => new TextEncoder().encode(s);
const fromBytes = (b: Uint8Array | null) =>
  b ? new TextDecoder().decode(b) : null;

describe('browser adapter integration', () => {
  test('round-trips values via DBWrapper + BrowserDataStore', async () => {
    const db = createBrowserDatabase('minitsis-test');
    await db.set('hello', toBytes('world'));
    const loaded = await db.get('hello');
    expect(fromBytes(loaded)).toBe('world');
    expect(await db.count()).toBe(1);
    await db.delete('hello');
    expect(await db.count()).toBe(0);
  });
});
