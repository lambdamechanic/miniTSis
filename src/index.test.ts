// Assuming you have already translated minithesis functions and classes to TypeScript
import {
  runTest,
  integers,
  bigIntegers,
  lists,
  Random,
  TestCase,
  MapDB,
} from './index'; // Adjust import path as necessary
function sum(arr: number[]): number {
  return arr.reduce((acc, curr) => acc + curr, 0);
}

const originalConsoleLog = console.log;
let logMock: jest.SpyInstance;

beforeEach(() => {
  // Spy on console.log and keep a reference to the spy
  logMock = jest.spyOn(console, 'log').mockImplementation();
});

afterEach(() => {
  // Restore the original console.log function
  logMock.mockRestore();
});

describe('Minithesis Tests', () => {
  // test.each(Array.from({ length: 10 }, (_, i) => i))('finds small list - seed %i', (seed) => {
  //   //const database = new Map<string, Uint8Array>(); // Assuming a Map is used for the database

  //   // Define the test function
  //   const testFn = (testCase: TestCase) => {
  //     // console.error("test case in test function", testCase);
  //     //console.log("this:", this);
  //     const ls = testCase.any(lists(integers(BigInt(0), BigInt(10000)))).map((i: bigint) => toNumber(i));
  //     // console.log("example", JSON.stringify(ls));

  //     // coalnsole.log(ls.length);
  //     // console.log("after test case in test function", testCase);
  //     if (sum(ls) > 1000) {
  // 	console.log(ls);
  // 	throw new Error('all bad');
  //     }

  //   };

  //   expect(() => {
  //     const random = new Random(seed); // Ensure Random class supports seeding
  //     const database = new MapDB();
  //     //      console.log('running a test');
  //     runTest(100, random, database, false)(testFn);
  //   }).toThrow('all bad');
  // });

  test.each(Array.from({length: 10}, (_, i) => i))(
    'finds small list new - seed %i',
    seed => {
      const testFn = (testCase: TestCase) => {
        // Minithesis logic should automatically log the generated values
        const ls = testCase.any(lists(integers(0, 10000)));
        if (sum(ls) > 1000) {
          // Logic to fail the test, expecting minithesis to have logged the value generation
          throw new Error('Assertion failed: sum(ls) <= 1000');
        }
      };

      try {
        const random = new Random(seed);
        const database = new MapDB();
        expect(() => {
          runTest(100, random, database, false)(testFn);
        }).toThrow('Assertion failed: sum(ls) <= 1000');
      } finally {
        // Verify the log includes the expected message from minithesis logic, not the testFn
        expect(logMock).toHaveBeenCalledWith(
          expect.stringContaining('any(lists(integers(0, 10000))): [1001]')
        );
      }
    }
  );

  test('reduces additive pairs', () => {
    const random = new Random(1212); // Use appropriate seed if necessary
    const database = new MapDB();

    const testFn = (testCase: TestCase) => {
      const m = testCase.choice(BigInt(1000));
      const n = testCase.choice(BigInt(1000));
      // console.info(`(${m}, ${n})`);
      if (m + n > 1000) {
        // console.log(`choice(1000): ${m}`, `choice(1000): ${n}`);
        throw new Error('Assertion failed: m + n > 1000');
      }
    };

    expect(() => {
      runTest(10000, random, database, false)(testFn);
    }).toThrow('Assertion failed: m + n > 1000');

    // logMock.mock.calls.forEach((call, index) => {
    //   originalConsoleLog(`Call ${index + 1}:`, call.join(', '));
    // });

    expect(logMock).toHaveBeenCalledWith(
      expect.stringContaining('choice(1000): 1')
    );
    expect(logMock).toHaveBeenCalledWith(
      expect.stringContaining('choice(1000): 1000')
    );
  });
});
