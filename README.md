# MiniTSis

This is a more-or-less faithful clone of David MacIver's [Minithesis](https://github.com/drmaciver/minithesis).

## Why use this?

This is, charitably, a very small, young project. It has far fewer generators than mature TypeScript
projects like [fast-check](https://fast-check.dev/), which was what I was using
until I bumped into the problem with fast-check's shrinking: namely, that it can't shrink
effectively through monadic bindings. [This
issue](https://github.com/dubzzz/fast-check/issues/650#issuecomment-648397230) illustrates the core
of the problem: once you've used `chain` (or `bind`, in Minithesis's terminology), you are pretty
much on your own. Because MiniTSis inherits an [internal shrinking
methodology](https://drmaciver.github.io/papers/reduction-via-generation-preview.pdf) from
Minithesis, you can actually guarantee optimal shrinking (at least given enough time, in small cases):

```
  test( 'shrinking regression in fast-check', async () => {
    const testFn = (testCase: TestCase) => {
      const [a, b] = testCase.any(integers(0,100).bind(b =>	tuples(integers(0,b), just(b))))

      // The predicate that will fail if 'a' and 'b' are not close enough
      if (b - a > 5n) {
		  throw new Error(`Predicate failed: b (${b}) - a (${a}) > 5`);
      }
    };


    expect(runTest(100, new Random(), new MapDB(), false)(wrapWithName(testFn)))
      .rejects.toThrow("Predicate failed: b (6) - a (0) > 5")
  });
```

In practice, better shrinking really does make it much easier to find minimal test cases, which
makes development faster and more fun.

The other thing that it implements is a persistent test case database, which means that if you've
found a test case breakage once, it will be tried immediately next time you run the test, which can
be helpful if you had to do a lot of work to get the breakage. (MiniTSis itself is reasonably quick,
even despite heavy use of bigints rather than numbers, but for my use case, individual property
checks can easily take seconds.)


## Wow, there really aren't many generators, are there

No, there aren't. Unlike Minithesis, though, I'd quite like for this to work for people
using TS and JS in production. PRs for more generators gratefully received!

## What's this wrapWithName nonsense?

I pull an evil trick to pull some test name information from the Jest runner, and hang it as a
property on the side of the passed-in test function. In Minithesis it's done with decorators, but we
don't have that in TypeScript, and we actually do need a real, unique name so that the test database
can store results.

This does mean that if you change your test names, your failing tests may take a little longer to
run until they find the breaks again.


## What's left to do?

I made a halfhearted effort at making it run on the client side by abstracting out the test database
so that it can be run using `localStorage`, but the test harness still uses the `fs/promises` module
so I don't expect the test suite to actually run clientside. This is fixable with time and effort.

More generators, as mentioned.

`fast-check` compatibility shim, if possible.

set up CI on github.
