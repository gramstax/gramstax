---
title: Background work with worker threads
description: Move work off the update path with the sibling package @gramstax/worker-thread, launched from a boot hook and called from a gramstax page.
icon: cpu
---

# Background work with worker threads

Everything a gramstax page does happens inside the update path. A slow read, a
third-party call, a batch job: the user waits, the per-chat gate holds the next
update back, and if the [update queue](/guides/update-queue) is on, the work
occupies one of its concurrency slots.

Some work does not belong there. A ticker that warms a cache, a counter that has
to keep running while nobody is talking, a batch that would be fifteen seconds of
latency if it ran inline. That is what the sibling package
`@gramstax/worker-thread` is for: a real thread, launched at boot, whose methods
are callable from a page as if they were local async functions.

This page is worked from
[`example/1-complex`](https://github.com/gramstax/gramstax/tree/main/example/1-complex),
the kitchen-sink example, whose `start/counter/thread` route renders a number
that a background thread is incrementing while the bot is up.

## Install

It is a separate npm package, versioned and released with the framework (both
are at `latest`), and nothing in `gramstax` depends on it.

```bash
bun add @gramstax/worker-thread
```

Imports come from the package root:
`import {WorkerThreadExport, WorkerThreadInit} from "@gramstax/worker-thread"`.
It runs on Bun and on Node.js 18 or newer, so it does not force a runtime choice
on the bot that uses it.

## One file holds both halves

The pattern that makes this package small is that a single file declares the
worker **and** the main-thread handle for it. `WorkerThreadInit` is the base the
worker's own class extends, and `WorkerThreadExport.init()` reads that same class
and returns the proxy the main thread imports.

```ts
// example/1-complex/src/jobs/increment.ts
import {WorkerThreadExport, WorkerThreadInit} from "@gramstax/worker-thread"
import {log} from "gramstax"

export class Worker extends WorkerThreadInit {
  count = 0
  constructor() {
    super()
    const ms = Number(process.argv[3])
    this.mtdAutoRun(ms)
  }

  mtdAutoRun(ms: number) {
    const padStart = `(${this.pid}:${this.id}) [IncrementCoreJob]`
    log.debug(`${padStart} Started..`)
    setInterval(() => {
      this.count += 1
      log.debug(`${padStart} count: ${this.count}`)
    }, ms)
  }

  mtdGetCount() {
    return this.count
  }
}

export const IncrementJob = WorkerThreadExport.init({path: __filename, WTInit: Worker})
```

Four things in twenty-six lines:

| Line | Why it is there |
| :--- | :------------- |
| `class Worker extends WorkerThreadInit` | the base class runs the RPC handler and signals ready; the constructor is where worker-side setup belongs |
| `path: __filename` | the worker file is this file, which is why one file can hold both halves |
| `WTInit: Worker` | the proxy's `mtd*` surface is **derived** from this class, so renaming `mtdGetCount` breaks every call site at compile time |
| `process.argv[3]` | launch arguments land here; index 2 is the package's own routing token, so yours start at index 3 |

`mtdGetCount` is deliberately trivial. Its body is the entire payload, and its
type travels with it: the proxy is not a copy of the worker's methods, it is
generated from them.

## Launching it at boot

A worker is launched once, from `hookAfterStart`, which gramstax calls once the
bot is up. It is a normal lifecycle hook, not worker-thread API:

```ts
// example/1-complex/src/core/bot.ts
import {CacheExternal, Gramstax} from "gramstax"
import {UserGuard} from "~/guards/user"
import {IncrementJob} from "~/jobs/increment"
import {StatusPage} from "~/pages/status"
import {CtxCore} from "./ctx"

export class BotCore extends Gramstax {
  cacheData = new CacheExternal(`memory`)

  async hookAfterStart() {
    await IncrementJob.launchWorker([5000]) // 5s
  }
```

<Note>
  Trimmed from the file for this page: `createCtx`, `hookBeforeRoute`,
  `hookErrorPage`, and `hookNotFoundPage`.
</Note>

`launchWorker` resolves when the worker signals that it is ready, so `await` on
it is the difference between a worker you can call and one you cannot. The
argument is the argv slice, and `[5000]` becomes `process.argv[3]` inside the
worker, which is the tick interval in milliseconds.

Note what the example does **not** keep: the handle `launchWorker` resolves
with. It does not need to, because the proxy tracks every worker it has
launched, and `IncrementJob.shutdown()` drains all of them. If you want the
per-worker handle (for `threadId`, or `kill()` on exactly one thread), assign
the result.

<Warning>
  `launchWorker` is unconditional in this example, and that is fine for a bot
  that always runs on a host with threads. On `deploy: "serverless"` the bot
  runs inside an isolate with no Node.js thread runtime, so feature-gate the
  launch or keep worker-backed code out of the shared path.
</Warning>

## Calling it from a page

Nothing special happens at the call site. `IncrementJob.mtdGetCount()` reads
like a local async function, and from a page that is exactly what it is, one
await away.

```ts
// example/1-complex/src/pages/start/counter/thread.ts
import {PageBase} from "~/base/page"
import {IncrementJob} from "~/jobs/increment"
import {StartPage} from "~/pages/start"

export class StartCounterThreadPage extends PageBase {
  static data = this.buildData((exe?: string) => [exe])

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  async handleArgsCallbackQueryData() {
    const [exe] = this.callbackQueryDataArgs
    if (exe === `1`) {
      await this.gdefault.process()
    }
  }

  helper = {}
  gdefault = {
    show: async () => {
      const count = await IncrementJob.mtdGetCount() // difference thread
      await this.renderText({keyboard: this.inlineKeyboardT([this.data.callbackQueryData(`1`), StartPage]), data: {count, timestamp: Date.now()}})
    },
    process: async () => {
      await this.gdefault.show()
    }
  }
```

The page does one interesting thing and one ordinary thing. The interesting one is
`mtdGetCount()`: the count is not a shared variable, it was incremented in
another thread a moment ago, and reading it is a round trip. The ordinary one is
that the value then goes into `renderText` as `{{count}}`, exactly like any other
render datum, so [the render contract](/concepts/render-contract) is unchanged
by any of this.

`process` simply calls `show` again, which is why pressing the button appears to
do nothing except move the number: the page re-reads the worker, and the worker
has been ticking since boot.

## The `mtd` prefix is the boundary

Only methods whose name starts with `mtd` are meant to cross the thread boundary.
Read the worker class again with that in mind:

| Member | Crosses? | Why |
| :----- | :------- | :-- |
| `mtdGetCount()` | yes | it is the page's read of the worker state |
| `mtdAutoRun(ms)` | yes, though nothing calls it remotely | it is reachable, so it is part of the exposed surface even when only the constructor uses it |
| `count` | no | a plain field; the main thread cannot read it, which is why `mtdGetCount` exists |
| `constructor` | no | runs once, in the worker, at spawn |

The prefix is what makes the surface greppable and keeps internals private. The
package's own documentation is candid that it is a convention rather than a
security boundary: the dispatcher refuses a small denylist of dangerous names and
allows the rest, so treat `mtd*` as an API decision, not as access control.

## Lifecycle: two ways to stop

| Call | Behaviour |
| :--- | :-------- |
| `shutdown(timeoutMs?)` | sends the shutdown RPC, so the worker runs `onBeforeExit()`, then terminates. Force-kills after the timeout, which defaults to 5000 ms |
| `kill()` | terminates immediately, no cleanup |

`onBeforeExit()` is the worker's drain hook: override it to flush a buffer or
close a file before the thread goes away. `shutdown()` and `kill()` are both
permanent; neither worker can be resumed, so restarting means launching again.

`example/1-complex` never stops its worker. The process exiting is enough for a
demo, and it is a reminder that the drain is opt-in: if your worker holds work
that must not be lost, call `shutdown()` and give `onBeforeExit()` something to
do.

## What a slow or dead worker does

Two behaviours matter more than the happy path, and both are handled for you.

**Timeouts.** Every request defaults to 30 seconds
(`DEFAULT_REQUEST_TIMEOUT_MS`). A call that outlives it rejects on the main
thread, and passing `0` for the per-call timeout disables it. The catch is worth
knowing: a timed-out call does not stop the work, only the waiting. A naive retry
then runs the method twice.

**Crashes.** When a worker dies, its pending calls reject rather than hanging
forever, so a page awaiting a dead worker falls through to
`hookErrorPage` instead of stalling.

Neither is a substitute for a handler that is written to be called twice. The
transport retries failed writes and replays in-flight requests, so delivery is
at-least-once.

## Errors are silent until you attach

The package never writes to the console, and a worker error with no listener
attached is dropped. If a worker dies in production you want to know, so install
a handler once at boot:

```ts
import {WorkerThreadErrorHandler} from "@gramstax/worker-thread"

WorkerThreadErrorHandler.setDefault((err) => logger.error(err))
```

That line does not come from the example, which runs with a live console and
would rather not see anything. It is the documented way to turn the silent
default into your own logging, and it is worth adding to any bot that launches a
worker.

## Many workers, and workers talking to each other

The example launches one worker, which is the case most bots have. The package
also covers the two shapes that show up when one is not enough, and neither is
needed for the wiring above:

| Shape | Export | What it gives you |
| :---- | :----- | :--------------- |
| Many workers, one worker class | `WorkerThreadPool` | round-robin by default, `{mode: "broadcast"}` to fail fast on any, `{mode: "settled"}` to report per worker instead |
| Worker to worker | `WorkerThreadInit.createGatewayServer` and `createGatewayClient` | a socket channel between two workers, so siblings do not relay through the main thread |

The gateway is worth knowing about because `node:worker_threads` gives every
worker exactly one channel, and it points at the main thread. The gateway is the
second one. It is opt-in, it needs a shared token, and on Windows it normalizes
paths to named pipes.

## Testing a worker

The e2e harness runs real worker threads. `deploy: "test"` sets `bot.ready` to a
promise that awaits `hookBeforeStart` and then `hookAfterStart`, so the same
`launchWorker` call the bot makes at boot also happens in the test, and the page
under test calls a live thread.

```ts
// example/1-complex/e2e/start/counter/thread.test.ts
const intent = `start/counter/thread`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: CounterThreadPage`, () => {
  it(`show worker counter with count and timestamp`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, enUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toStartWith(`🧵 Worker counter`)
    expect(responses[0]!.body?.text).toContain(`Count:`)
    expect(responses[0]!.body?.text).toContain(`Timestamp:`)
```

<Note>
  Trimmed for this page: the two imports, and the `idUser` half of the test,
  which asserts the same thing against the `id` language block.
</Note>

The assertions are on the rendered text, not on the RPC, which is the right level
to assert at: what the user sees is the contract, and the count behind it is a
moving target. Running that file prints the worker's own debug line
(`[IncrementCoreJob] Started..`) before the test result, which is the simplest
confirmation that a real thread was spawned. [E2E
testing](/guides/e2e-testing) covers the harness.

## What this integration touches

Every identifier the wiring above uses, and where it lives.

| Identifier | Defined in | Used here for |
| :--------- | :---------- | :------------ |
| `WorkerThreadInit` | `packages/worker-thread/src/init.ts` | the base class `Worker` extends |
| `this.argv` | `packages/worker-thread/src/init.ts` | `process.argv`; launch arguments are readable from index 3 |
| `this.id` | `packages/worker-thread/src/init.ts` | the worker thread id, used in the debug line |
| `this.pid` | `packages/worker-thread/src/init.ts` | `process.pid`, shared by every worker in the process |
| `onBeforeExit()` | `packages/worker-thread/src/init.ts` | the drain hook a graceful `shutdown()` awaits |
| `WorkerThreadExport.init` | `packages/worker-thread/src/export.ts` | builds the typed proxy from `path` and `WTInit` |
| `launchWorker(argv?)` | the proxy built in `packages/worker-thread/src/export.ts` | spawn and wait for ready; args land at `argv[3]` |
| `shutdown(timeoutMs?)` (proxy) | `packages/worker-thread/src/export.ts` | drains every worker the proxy launched; the per-handle `WorkerThreadLaunch.shutdown` lives in `launch.ts` |
| `kill()` | `packages/worker-thread/src/launch.ts` | immediate terminate on one handle |
| `DEFAULT_REQUEST_TIMEOUT_MS` | `packages/worker-thread/src/rpc.ts` | the 30000 ms per-request timeout |
| `WorkerThreadErrorHandler.setDefault(fn)` | `packages/worker-thread/src/error-handler.ts` | routes worker errors to your logger instead of dropping them |
| `WorkerThreadPool` | `packages/worker-thread/src/pool.ts` | many workers over one worker class |
| `createGatewayServer` / `createGatewayClient` | `packages/worker-thread/src/init.ts` | the optional worker-to-worker socket channel |

`WorkerThreadLaunch` is the handle type `launchWorker` resolves with. The example
discards it, and the table above names it only because it is what a discarded
return value would have been.

## The rest of the package

`@gramstax/worker-thread` re-exports 27 names from its barrel, 12 runtime
values and 15 type definitions, through the 9 runtime modules and the shared
`types/` directory. `WorkerThreadPool` counts as both: it is a `const` value
and a same-named type, so the two lists overlap on that one name. The table
above names the thirteen identifiers this integration touches. The package's
own README is the complete reference for everything this page skipped: the
gateway option tables in full, the pool dispatch modes, the RPC middleware
chain, the constants (`DEFAULT_MAX_MESSAGE_SIZE`, `DENIED_RPC_METHODS`), and
the per-module export index.

- [`packages/worker-thread/README.md`](https://github.com/gramstax/gramstax/blob/main/packages/worker-thread/README.md)
  on GitHub, the full reference.
- `packages/worker-thread/example/` in the same repository, runnable clusters
  including a server/client gateway pair.

## Where to go next

<Columns cols={2}>
  <Card title="Update queue" icon="list-ordered" href="/guides/update-queue">
    The other half of off-path work: concurrency inside the update path itself.
  </Card>
  <Card title="Pages" icon="file-code" href="/guides/pages">
    The `g*` step shape the call sites above are written in.
  </Card>
  <Card title="Sessions" icon="messages-square" href="/guides/sessions">
    Where a page normally keeps state, and when a worker is the better answer.
  </Card>
  <Card title="Errors" icon="triangle-alert" href="/guides/errors">
    `hookErrorPage`, which is where a rejected worker call lands.
  </Card>
  <Card title="Storage with LMDB" icon="database" href="/guides/storage-lmdb">
    The other sibling package, for data that has to survive a restart.
  </Card>
  <Card title="Observability" icon="activity" href="/guides/observability">
    Metrics and traces for the update path the worker sits beside.
  </Card>
</Columns>