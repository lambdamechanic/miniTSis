import {runCommonMinitsisTests, MinitsisTestAdapter} from '@minitsis/testkit';
import {createBrowserDatabase} from '../src';

let counter = 0;

const adapter: MinitsisTestAdapter = {
  name: 'browser',
  makeDatabase: async () => {
    counter += 1;
    const db = createBrowserDatabase(`minitsis-browser-${counter}`);
    return {db, cleanup: async () => { /* localforage handles its own storage */ }};
  },
  makePersistentDatabase: async () => {
    const db = createBrowserDatabase(`minitsis-browser-persist-${counter++}`);
    return {db};
  },
};

runCommonMinitsisTests(adapter);
