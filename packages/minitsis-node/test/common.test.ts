import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import {runCommonMinitsisTests, MinitsisTestAdapter} from 'minitsis-testkit';
import {createNodeDatabase} from '../src';

const mkHandle = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'minitsis-node-'));
  const dbPath = path.join(dir, 'test.db');
  const db = createNodeDatabase(dbPath);
  return {db, cleanup: () => fs.rm(dir, {recursive: true, force: true})};
};

const adapter: MinitsisTestAdapter = {
  name: 'node',
  makeDatabase: mkHandle,
  makePersistentDatabase: mkHandle,
};

runCommonMinitsisTests(adapter);
