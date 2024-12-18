import { Status } from './index';

export interface ITestCase {
  prefix: bigint[];
  choices: bigint[];
  status?: Status;
  targetingScore?: number;
  
  choice(n: bigint): bigint;
  weighted(p: number): boolean;
  forcedChoice(n: bigint): bigint;
  reject(): never;
  assume(precondition: boolean): void;
  target(score: number): void;
  any<U>(possibility: IPossibility<U>): U;
  markStatus(status: Status): never;
}

export interface IPossibility<T> {
  produce(testCase: ITestCase): T;
  map<S>(f: (value: T) => S): IPossibility<S>;
  bind<S>(f: (value: T) => IPossibility<S>): IPossibility<S>;
  satisfying(f: (value: T) => boolean): IPossibility<T>;
}

export interface IDatabase {
  set(key: string, value: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  count?(): Promise<number>;
}
