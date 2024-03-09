// Example porting of the TestCase class from Python to TypeScript
// Note: This is a simplified version to illustrate the process. Full translation requires careful handling of all methods and properties.

// interface Database {
//     // Convert Python's protocol to TypeScript interface
//     [key: string]: Uint8Array; // Assuming bytes are handled as Uint8Array in TypeScript
// }

// Enums and other classes need to be handled similarly
export enum Status {
  OVERRUN = 0,
  INVALID = 1,
  VALID = 2,
  INTERESTING = 3,
}
// # We cap the maximum amount of entropy a test case can use.
// # This prevents cases where the generated test case size explodes
// # by effectively rejection
const BUFFER_SIZE = 8 * 1024;

export class Unsatisfiable extends Error {}
export class StopTest extends Error {}
export class Frozen extends Error {}

class Possibility<T> {
  public produce: (testCase: TestCase) => T;
  public name: string;

  constructor(produce: (testCase: TestCase) => T, name?: string) {
    // console.log("new possibility");
    this.produce = produce;
    this.name = name ?? produce.name;
  }

  toString(): string {
    return this.name;
  }

  map<S>(f: (value: T) => S): Possibility<S> {
    const newProduce = (testCase: TestCase): S => {
      return f(this.produce(testCase));
    };
    return new Possibility(newProduce, `${this.name}.map(${f.name})`);
  }

  bind<S>(f: (value: T) => Possibility<S>): Possibility<S> {
    const newProduce = (testCase: TestCase): S => {
      return f(this.produce(testCase)).produce(testCase);
    };
    return new Possibility(newProduce, `${this.name}.bind(${f.name})`);
  }

  satisfying(f: (value: T) => boolean): Possibility<T> {
    const newProduce = (testCase: TestCase): T => {
      for (let i = 0; i < 3; i++) {
        const candidate = this.produce(testCase);
        if (f(candidate)) {
          return candidate;
        }
      }
      testCase.reject();
    };
    return new Possibility(newProduce, `${this.name}.select(${f.name})`);
  }
}

export class TestingState {
  random: Random;
  testFunctionCallback: (testCase: TestCase) => void;
  maxExamples: number;
  validTestCases: number;
  calls: number;
  result?: bigint[]; // Assuming result is an array of numbers, adjust if needed
  bestScoring?: [number, bigint[]]; // Tuple in Python to array in TypeScript
  testIsTrivial = false;

  constructor(
    random: Random,
    testFunction: (testCase: TestCase) => void,
    maxExamples: number
  ) {
    this.random = random;
    this.testFunctionCallback = testFunction;
    this.maxExamples = maxExamples;
    this.calls = 0;
    this.validTestCases = 0;
  }

  public testFunction(testCase: TestCase): void {
    if (!this) {
      throw new Error('selfless');
    }
    //console.log("in testFunction", this);
    //    console.log("in testFunction, calls=", this.calls, " validTestCases=", this.validTestCases);

    try {
      this.testFunctionCallback(testCase);
    } catch (error) {
      if (!(error instanceof StopTest)) {
        throw error;
      }
    }
    //      console.log("Test case ", testCase);
    //      console.log("Test case status", testCase.status);
    if (testCase.status === undefined) {
      testCase.status = Status.VALID;
    }

    this.calls++;
    if (testCase.status >= Status.INVALID && testCase.choices.length === 0) {
      console.log('trivial');
      this.testIsTrivial = true;
    }
    if (testCase.status >= Status.VALID) {
      this.validTestCases++;

      if (testCase.targetingScore !== undefined) {
        const relevantInfo: [number, bigint[]] = [
          testCase.targetingScore,
          testCase.choices,
        ];
        if (this.bestScoring === undefined) {
          console.log('first time setting best scoring to', relevantInfo);
          this.bestScoring = relevantInfo;
        } else {
          const [bestScore, _] = this.bestScoring;
          if (testCase.targetingScore > bestScore) {
            console.log('updating best scoring to', relevantInfo);
            this.bestScoring = relevantInfo;
          }
        }
      }
    }

    if (
      testCase.status === Status.INTERESTING &&
      (this.result === undefined ||
        // sorting keys don't work so well in typescript.
        smallerThan(testCase.choices, this.result))
    ) {
      // console.info(`choices ${testCase.choices} is better than ${this.result}`);
      this.result = testCase.choices;
    }
  }

  async target(): Promise<void> {
    if (this.result !== undefined || this.bestScoring === undefined) {
      return;
    }

    const adjust = async (i: number, step: bigint): Promise<boolean> => {
      if (!this.bestScoring) {
        throw new Error('bestScoring undefined, should be impossible');
      }

      const [score, choices] = this.bestScoring;
      if (choices[i] + step < 0n || choices[i] + step >= BigInt(2 ** 64)) {
        return false;
      }
      const attempt = choices.slice(); // Clone array
      attempt[i] += step;
      const testCase = new TestCase(attempt, this.random, attempt.length); // Adjust as needed

      await this.testFunction(testCase); // Ensure testFunction handles async correctly
      if (testCase.status === undefined) {
        throw new Error(
          `status undefined, should be impossible; ${testCase}, ${i}, ${step}, ${this.bestScoring}`
        );
      }
      return (
        testCase.status >= Status.VALID &&
        testCase.targetingScore !== undefined &&
        testCase.targetingScore > score
      );
    };

    while (this.shouldKeepGenerating()) {
      const i = this.random.randInt(0, this.bestScoring[1].length - 1);
      let sign = 0n;
      for (const k of [1n, -1n]) {
        if (!this.shouldKeepGenerating()) {
          return;
        }
        if (await adjust(i, k)) {
          sign = k;
          break;
        }
      }
      if (sign === 0n) {
        continue;
      }

      let k = 1n;
      while (this.shouldKeepGenerating() && (await adjust(i, sign * k))) {
        k *= 2n;
      }

      while (k > 0n) {
        while (this.shouldKeepGenerating() && (await adjust(i, sign * k))) {
          // Intentionally empty
        }
        k /= 2n;
      }
    }
  }

  async run(): Promise<void> {
    //console.log("toplevel generate");
    this.generate();
    //console.log("toplevel target");
    await this.target();
    // console.log("toplevel shrink");
    this.shrink();
    // console.error("toplevel done!");
  }

  generate(): void {
    while (
      this.shouldKeepGenerating() &&
      (this.bestScoring === undefined ||
        this.validTestCases <= this.maxExamples / 2)
    ) {
      //console.log(`generate loop: valid:${this.validTestCases} max:${this.maxExamples} bestScoring:${this.bestScoring}`);
      const testCase = new TestCase([], this.random, BUFFER_SIZE);
      this.testFunction(testCase);
    }
    // console.log("finished generating");
  }

  shrink(): void {
    if (!this.result) {
      return;
    }

    const cached = new CachedTestFunction(this.testFunction.bind(this));

    const consider = (choices: bigint[]): boolean => {
      if (bigintArraysEqual(choices, this.result)) {
        return true;
      }
      return cached.call(choices) === Status.INTERESTING;
    };

    if (!consider(this.result)) {
      throw new Error('current result inconsiderable');
    }

    let prev;
    while (prev === undefined || !bigintArraysEqual(prev, this.result)) {
      prev = this.result ? [...this.result] : [];

      for (let k = 8; k > 0; k /= 2) {
        for (let i = this.result.length - k - 1; i >= 0; i--) {
          if (i >= this.result.length) {
            i--;
            continue;
          }
          const attempt = [
            ...this.result.slice(0, i),
            ...this.result.slice(i + k),
          ];
          if (!consider(attempt)) {
            if (i > 0 && attempt[i - 1] > 0) {
              attempt[i - 1]--;
              if (consider(attempt)) {
                i++;
              }
            }
          }
          i--;
        }
      }

      const replace = (values: {[key: number]: bigint}): boolean => {
        if (!this.result) {
          throw new Error('should have a result here');
        }
        const attempt = [...this.result];
        for (const [i, v] of Object.entries(values)) {
          const index = parseInt(i);
          if (index >= attempt.length) {
            return false;
          }
          attempt[index] = v;
        }
        // console.log(`lengths   ${attempt.length} and result ${this.result.length}`)
        // console.log(`attempt is ${attempt}`);
        // console.log(`result is ${this.result}`);
        return consider(attempt);
      };

      for (let k = 8; k > 1; k /= 2) {
        for (let i = this.result.length - k; i >= 0; i--) {
          if (
            replace(
              Object.fromEntries(
                Array.from({length: k}, (_, idx) => [i + idx, BigInt(0)])
              )
            )
          ) {
            i -= k;
          } else {
            i--;
          }
        }
      }

      for (let i = this.result.length - 1; i >= 0; i--) {
        binSearchDown(BigInt(0), this.result[i], (v: bigint) =>
          replace({[i]: v})
        );
      }
      // First try deleting chunks of choices
      for (let k = 8; k > 0; k /= 2) {
        for (let i = this.result.length - k - 1; i >= 0; i--) {
          if (this.result === undefined) {
            throw new Error('never undefined here');
          }
          const attempt: bigint[] = [
            ...this.result.slice(0, i),
            ...this.result.slice(i + k),
          ];
          consider(attempt);
        }
      }

      // Try replacing blocks of choices with zeroes, then adjust for smaller values
      for (let k = 8; k >= 1; k /= 2) {
        if (this.result === undefined) {
          throw new Error('never undefined here');
        }
        for (let i = 0; i <= this.result.length - k; i++) {
          if (this.result === undefined) {
            throw new Error('never undefined here');
          }
          const attempt: bigint[] = [...this.result];
          for (let j = i; j < i + k; j++) {
            attempt[j] = BigInt(0); // Reset chunk to zeroes
          }
          consider(attempt);
        }
      }

      // for reducing additive pairs
      for (let k = 2; k >= 1; k--) {
        for (let i: number = this.result.length - 1 - k; i >= 0; i--) {
          const j = i + k;
          if (j < this.result.length) {
            // Try swapping out of order pairs
            if (this.result[i] > this.result[j]) {
              replace({[i]: this.result[j], [j]: this.result[i]});
            }
            // Adjust nearby pairs by redistributing value
            if (j < this.result.length && this.result[i] > BigInt(0)) {
              const previousI = this.result[i];
              const previousJ = this.result[j];
              binSearchDown(BigInt(0), previousI, (v: bigint) => {
                // Attempt to replace the value at i with v and adjust j accordingly
                return replace({
                  [i]: v,
                  [j]: previousJ + (previousI - v),
                });
              });
            }
          }
        }
      }
    }
  }

  shouldKeepGenerating(): boolean {
    return (
      !this.testIsTrivial &&
      this.result === undefined &&
      this.validTestCases < this.maxExamples &&
      this.calls < this.maxExamples * 10
    );
  }
}

// Helper function for sorting choices. Adjust according to your actual use case.
function sortKey(choices: bigint[]): [number, bigint[]] {
  return [choices.length, choices];
}

function compareArraysBadly(a: bigint[], b: bigint[]): boolean {
  return sortKey(a) < sortKey(b);
}

export class CachedTestFunction {
  private testFunction: (testCase: TestCase) => void;
  // Using Map to represent a tree structure
  // this could be done better with something like

  //   interface INode<T> {
  //   [key: string]: Node<T>; // Use generic type T for node values
  // }

  // type Node<T> = INode<T> | T;
  // next version perhaps.
  private tree: Map<number, any> = new Map();

  constructor(testFunction: (testCase: TestCase) => void) {
    this.testFunction = tc => {
      // console.log("entering testfunction");
      const r = testFunction(tc);
      // console.log("returning from testfunction", r, tc);
      return r;
    };
  }

  public call(choices: bigint[]): Status {
    //console.log("entering cached call", JSON.stringify(choices.map((a) => toNumber(a))));
    //console.log("tree", this.tree);
    let node: any = this.tree; // Start at the root of the tree
    for (const c of choices) {
      node = node.get(c);
      if (node === undefined) {
        // console.log("undefined node");
        break;
      }
      // console.log("node is ", node);
      // If we encounter a Status value, it means we've previously computed this path
      if (Object.values(Status).includes(node)) {
        // Asserting that it's not OVERRUN just for validation, similar to the original Python
        if (node === Status.OVERRUN)
          throw new Error('Unexpected overrun status');
        return node;
      }
    }
    // equivalent to a KeyError in python
    if (node !== undefined && !Object.values(Status).includes(node)) {
      return Status.OVERRUN;
    }

    //console.log("past choices", JSON.stringify(choices.map((a) => toNumber(a))));

    // Correctly use the static forChoices method to create a new TestCase
    const testCase = TestCase.forChoices(choices);
    // console.log("testcase from choices", testCase);
    //console.log("re-entering testFunction", testCase);
    this.testFunction(testCase);
    // console.log("after testfunction");
    if (testCase.status === undefined)
      throw new Error('Test case did not set a status');

    // Re-traverse the choices to update the tree with the new outcome
    node = this.tree;
    choices.forEach((c, i) => {
      // console.log("choices: " + JSON.stringify({c,i}));
      if (i + 1 < choices.length || testCase.status === Status.OVERRUN) {
        if (!node.has(c)) {
          node.set(c, new Map());
        }
        node = node.get(c);
      } else {
        // For the last choice or when status is OVERRUN, set the status
        node.set(c, testCase.status);
      }
    });

    return testCase.status;
  }
}

export function runTest(
  maxExamples = 100,
  random?: Random,
  database?: Database, // Assume Database interface/type is defined elsewhere
  quiet = false
): (test: (testCase: TestCase) => void) => Promise<void> {
  return async (test: (testCase: TestCase) => void) => {
    const markFailuresInteresting = (testCase: TestCase): void => {
      // console.log("markFailuresInteresting", testCase);
      try {
        test(testCase);
      } catch (error) {
        //	console.log("markFailuresInterestingError: case", testCase);
        //	console.log("markFailuresInterestingError: error", error);
        if (testCase.status !== undefined) {
          //	  console.log("markFailuersINteresting: status is not undefined");
          throw error;
        } else {
          //	  console.log("markFailuersINteresting: status is undefined");
        }
        testCase.markStatus(Status.INTERESTING);
      }
    };

    const defRandom = random ? random : new Random();
    const testName = (test as any).testName;
    const state = new TestingState(
      defRandom,
      markFailuresInteresting,
      maxExamples
    );
    if (!database) {
      throw new Error('need a db');
    }
    const db = database; // || new DirectoryDB(".minitest-cache");

    const previousFailure = await db.get(testName);
    if (previousFailure !== null) {
      const choices: bigint[] = [];
      for (let i = 0; i < previousFailure.length; i += 8) {
        // Use DataView to interpret each group of 8 bytes as a 64-bit big-endian integer
        const bigintNumber = new DataView(
          previousFailure.buffer,
          previousFailure.byteOffset + i,
          8
        ).getBigInt64(0, false);
        console.log('big int number', bigintNumber);
        choices.push(bigintNumber);
      }
      console.log(
        'choices from previous failure',
        choices.map(a => toNumber(a))
      );
      state.testFunction(TestCase.forChoices(choices, !quiet));
    }
    //     console.log("state is", state);
    if (state.result === undefined) {
      await state.run();
    }

    if (state.validTestCases === 0) {
      console.log('unsatisfiable');
      throw new Unsatisfiable();
    }

    if (state.result === undefined) {
      await db.delete(testName);
    } else {
      // Calculate the total byte length needed (8 bytes per bigint)
      const totalBytes = state.result.length * 8;
      const buffer = new ArrayBuffer(totalBytes);
      const view = new DataView(buffer);

      // Convert each bigint to 8 bytes and store them in the buffer
      state.result.forEach((bigint, index) => {
        // Note: DataView operates in byte offsets, so multiply index by 8
        view.setBigInt64(index * 8, bigint, false); // false for big-endian
      });

      // Create a Uint8Array from the buffer
      const uint8Array = new Uint8Array(buffer);
      // console.log(`setting ${test.name} to buffer ${uint8Array}`);
      // Set the Uint8Array in the database
      await db.set(testName, uint8Array);
      //      console.log(`running test again i guess? state.result=${state.result}`);
      const newTestCase: TestCase = TestCase.forChoices(state.result, !quiet);

      //      console.log(`new test case=${newTestCase}`);
      test(newTestCase);
      //       console.log("finished test");
    }
  };
}

export function integers(min: number, max: number): Possibility<number> {
  return new Possibility<number>((testCase: TestCase) => {
    // Generate a random integer between min and max
    return min + Number(testCase.choice(BigInt(max - min)));
  }, `integers(${min}, ${max})`);
}

export function bigIntegers(min: bigint, max: bigint): Possibility<bigint> {
  return new Possibility<bigint>((testCase: TestCase) => {
    // Generate a random integer between min and max
    return min + testCase.choice(max - min);
  }, `bigIntegers(${min}, ${max})`);
}

export function sublists<T>(list: T[]): Possibility<T[]> {
  const produce = (testCase: TestCase): T[] => {
    const result: T[] = [];
    for (const el of list) {
      if (testCase.weighted(0.5)) {
        result.push(el);
      }
    }
    return result;
  };

  return new Possibility(produce, `sublists(${JSON.stringify(list)})`);
}

export function lists<T>(
  elements: Possibility<T>,
  minSize = 0,
  maxSize = Infinity
): Possibility<T[]> {
  return new Possibility<T[]>((testCase: TestCase) => {
    // console.log(`in lists: min:${minSize}, max:${maxSize}`);
    const result: T[] = [];
    let continueLoop = true;
    let listLoop = 0;
    while (continueLoop) {
      listLoop += 1;
      //console.log(`list loop ${listLoop}`);
      if (result.length < minSize) {
        console.log('forced choice 1');
        testCase.forcedChoice(BigInt(1));

        // maxSize isn't _always_ Infinity
        // eslint-disable-next-line no-constant-condition
      } else if (result.length + 1 >= maxSize) {
        console.log('forced choice 0');
        testCase.forcedChoice(BigInt(0));
        continueLoop = false;
      } else {
        const weight = testCase.weighted(0.9);
        // console.log(`weight is ${weight}`);
        if (!weight) {
          // console.log("weighted 0.9");
          continueLoop = false;
        } else {
          // console.log("length wasn't less than minSize, or more than maxSize, and weighted didn't fire");
        }
      }
      if (continueLoop) {
        result.push(testCase.any(elements));
      }
    }
    // console.log("list results", result);
    return result;
  }, `lists(${elements})`);
}

export function just<T>(value: T): Possibility<T> {
  return new Possibility<T>(() => value, `just(${value})`);
}

export function toNumber(bigintValue: bigint): number {
  if (
    bigintValue > BigInt(Number.MAX_SAFE_INTEGER) ||
    bigintValue < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new Error(
      'BigInt value is too large to be safely converted to a Number'
    );
  }
  return Number(bigintValue);
}
export function mixOf<T>(...possibilities: Possibility<T>[]): Possibility<T> {
  if (possibilities.length === 0) {
    return nothing();
  }
  return new Possibility<T>(
    (testCase: TestCase) => {
      return testCase.any(
        possibilities[
          toNumber(testCase.choice(BigInt(possibilities.length - 1)))
        ]
      );
    },
    `mixOf(${possibilities.map(p => p.toString()).join(', ')})`
  );
}
export function nothing<T>(): Possibility<T> {
  return new Possibility<T>((testCase: TestCase) => {
    testCase.reject();
    //throw new Error("This line should never be reached because `testCase.reject()` should throw.");
  }, 'nothing');
}

// Implement DirectoryDB with Node.js's fs module or IndexedDB in browsers
// Additional TypeScript translations for minithesis
export interface Database {
  set(key: string, value: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

export class TestCase {
  prefix: bigint[];
  random: Random;
  maxSize: number;
  choices: bigint[] = [];
  status?: Status;
  printResults: boolean;
  depth = 0;
  targetingScore?: number;

  constructor(
    prefix: bigint[],
    random?: Random,
    maxSize = Infinity,
    printResults = true
  ) {
    this.prefix = prefix;
    // XXX Need a cast because below we assume self.random is not None;
    // it can only be None if max_size == len(prefix)
    this.random = random as Random;
    this.maxSize = maxSize;
    this.printResults = printResults;
    this.depth = 0;
  }

  static forChoices(choices: bigint[], printResults = false): TestCase {
    return new TestCase(choices, undefined, choices.length, printResults);
  }

  choice(n: bigint): bigint {
    const result = this.makeChoice(n, () =>
      this.random.randBigInt(BigInt(0), n)
    );
    if (this.shouldPrint()) {
      console.log(`choice(${n}): ${result}`);
    }
    return result;
  }

  weighted(p: number): boolean {
    // console.log(`weighted: ${p}`);
    if (!this) {
      throw new Error('badthis');
    }
    if (p <= 0) {
      return Boolean(this.forcedChoice(0n));
    } else if (p >= 1) {
      return Boolean(this.forcedChoice(1n));
    } else {
      //console.log("using weighted");
      const result = Boolean(
        this.makeChoice(BigInt(1), () => {
          const fl = this.random.randFloat();
          // console.log(`the float is ${fl}, p is ${p}`);
          return BigInt(fl <= p ? 1 : 0);
        })
      );
      if (this.shouldPrint()) {
        console.log(`weighted(${p}): ${result}`);
      }
      return result;
    }
  }

  forcedChoice(n: bigint): bigint {
    if (n < 0 || n > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Invalid choice ${n}`);
    }
    if (this.status !== undefined) {
      throw new Frozen();
    }
    if (this.choices.length >= this.maxSize) {
      this.markStatus(Status.OVERRUN);
    }
    console.log(`pushing ${n} onto choices`);
    this.choices.push(n);
    return n;
  }

  reject(): never {
    this.markStatus(Status.INVALID);
    //throw new Error("Test case rejected");
  }

  assume(precondition: boolean): void {
    if (!precondition) {
      this.reject();
    }
  }

  target(score: number): void {
    this.targetingScore = score;
  }

  any<U>(possibility: Possibility<U>): U {
    if (!this) {
      throw new Error('selfless possibility on any');
    }

    // console.error(`entering any with this ${this} and ${possibility}`);
    let result: U;
    try {
      this.depth += 1;
      // console.log("possibility is", possibility);
      result = possibility.produce(this);
      //console.log("possibility production", result);
    } finally {
      // console.log("exiting any at depth", this.depth);
      this.depth -= 1;
    }
    if (this.shouldPrint()) {
      console.log(`any(${possibility}): [${result}]`);
    }
    return result;
  }

  markStatus(status: Status): never {
    if (this.status !== undefined) {
      throw new Frozen();
    }
    this.status = status;
    throw new StopTest();
    // throw new Error("stop!");
  }

  private shouldPrint(): boolean {
    // console.info("shouldprint?", this.printResults, this.depth);
    return this.printResults && this.depth === 0;
  }

  private makeChoice(n: bigint, rndMethod: () => bigint): bigint {
    if (n < 0) {
      // no test for > 2^64 because bigint is unbounded.
      throw new Error(`Invalid choice ${n}`);
    }
    if (this.status !== undefined) {
      throw new Frozen();
    }
    if (this.choices.length >= this.maxSize) {
      this.markStatus(Status.OVERRUN);
    }
    let result;
    if (this.choices.length < this.prefix.length) {
      // console.warn(`using pre-existing choice at n is ${n}, prefix: ${this.prefix}, choices: ${this.choices}`);
      result = this.prefix[this.choices.length];
    } else {
      // console.log(`using rndMethod`);
      result = rndMethod();
    }
    this.choices.push(result);
    if (result > n) {
      this.markStatus(Status.INVALID);
    }
    return result;
  }

  public toString(): string {
    return `TestCase {
prefix: [${this.prefix.map(x => x.toString()).join(', ')}],
random: Random { seed: ${this.random.seed} },
maxSize: ${this.maxSize},
choices: [${this.choices.map(x => x.toString()).join(', ')}],
status: ${this.status ? Status[this.status] : 'undefined'},
printResults: ${this.printResults},
depth: ${this.depth},
targetingScore: ${
      this.targetingScore !== undefined ? this.targetingScore : 'undefined'
    }
}`;
  }
}

export function tuples<T extends unknown[]>(
  ...possibilities: {[K in keyof T]: Possibility<T[K]>}
): Possibility<T> {
  return new Possibility<T>(
    (testCase: TestCase) => {
      return possibilities.map(possibility => testCase.any(possibility)) as T;
    },
    `tuples(${possibilities.map(p => p.toString()).join(', ')})`
  );
}

export class MapDB implements Database {
  private data: Map<string, Uint8Array>;

  constructor() {
    this.data = new Map();
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    this.data.set(key, value);
  }

  async get(key: string): Promise<Uint8Array | null> {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export function binSearchDown(
  lo: bigint,
  hi: bigint,
  f: (n: bigint) => boolean
): bigint {
  if (f(lo)) {
    return lo;
  }
  while (lo + BigInt(1) < hi) {
    const mid = lo + (hi - lo) / BigInt(2);
    if (f(mid)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return hi;
}

// rough and ready random class that at some point should be replaced with something
// more professional.
export class Random {
  private a = 1664525;
  private c = 1013904223;
  private m: number = 2 ** 32;
  public seed: number;

  constructor(seed?: number) {
    if (seed === undefined) {
      // If no seed is provided, generate one using Math.random()
      // Note: Math.random() returns a number in [0, 1), so we scale it to an appropriate seed value
      this.seed = Math.floor(Math.random() * this.m);
    } else {
      this.seed = seed % this.m;
    }
  }

  // Generates the next pseudorandom number
  next(): number {
    this.seed = (this.a * this.seed + this.c) % this.m;
    return this.seed / this.m;
  }

  // Generates a random integer between min (inclusive) and max (inclusive)
  randInt(min: number, max: number): number {
    const rand = this.next();
    return Math.floor(rand * (max - min + 1)) + min;
  }

  // Generates a random floating-point number between min (inclusive) and max (exclusive)
  randFloat(min = 0, max = 1): number {
    const rand = this.next();

    const theFloat = rand * (max - min) + min;
    // console.log(`randFLoat: ${rand}, ${theFloat}`);
    return theFloat;
  }
  // Generates a random BigInt between min (inclusive) and max (inclusive)
  randBigInt(min: bigint, max: bigint): bigint {
    if (min > max) {
      throw new Error('min must be less than or equal to max');
    }

    // The range (max - min + 1) should be a bigint
    const range = max - min + BigInt(1);

    const r = this.next();
    // console.log(`r is ${r}`);
    // Generate a random number in [0, 1) as a BigInt
    const randomFraction = BigInt(Math.floor(r * Number.MAX_SAFE_INTEGER));

    // Adjust the fraction to fit within the range, then add min to shift to the correct interval
    const res =
      (randomFraction * range) / BigInt(Number.MAX_SAFE_INTEGER) + min;
    // console.log(`res is ${res}`);
    return res;
  }

  // Generates a random integer between min (inclusive) and max (exclusive)
  randRange(min: number, max: number): number {
    const rand = this.next();
    return Math.floor(rand * (max - min)) + min;
  }
}

function bigintArraysEqual(
  a: bigint[] | undefined,
  b: bigint[] | undefined
): boolean {
  if (!a || !b) {
    return false;
  } // we don't care about comparing two nulls.
  if (a.length !== b.length) {
    return false; // Arrays of different lengths are automatically unequal
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false; // Found elements that are not equal
    }
  }

  return true; // All elements are equal
}

function smallerThan(a: bigint[], b: bigint[]): boolean {
  if (a.length < b.length) return true;
  if (a.length > b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }

  return false; // Arrays are equal
}
