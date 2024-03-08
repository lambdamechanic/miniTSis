import { IDataStore } from './IDataStore';
import { BrowserDataStore } from './BrowserDataStore';
import { NodeDataStore } from './NodeDataStore';


var _nodejs = (typeof process !== 'undefined' && process.versions && process.versions.node);


const isBrowser: boolean = _nodejs === undefined

export function createDataStore<U>(dbPath: string): IDataStore<U> {
  if (isBrowser) {
    // We're in a browser environment
    return new BrowserDataStore<U>(dbPath); // The dbPath is ignored in the browser
  } else {
    // We're in a Node.js environment
    return new NodeDataStore<U>(dbPath);
  }
}
