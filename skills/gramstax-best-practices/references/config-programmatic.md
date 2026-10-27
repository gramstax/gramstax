# config-programmatic

`gramstax.config.ts` is the default entry, not the only one. Constructing `new BotCore({...})` yourself is fully supported — it is the **advanced** path for cases the config shape cannot express.

## Why

`gramstax start` reads the config, discovers **one** `Gramstax` subclass, and constructs it **once** (`src/cli/start.ts:34`). That is a deliberate constraint: one file, one token, one bot, one lifecycle. Anything outside that shape — N processes, N bots, your own supervisor, your own HTTP server — has to reach past the CLI. The constructor is public and stable; the config file is just a loader around it.

Use the config unless you have a concrete reason below. Reach for this rule when you can name the reason.

## When you need it

| Case | Why the config cannot do it |
| --- | --- |
| **Node `cluster`** | one instance per worker process; each needs its own wiring (worker id, distinct status port or none, shared vs per-process caches) |
| **Multi-bot in one process** | the config carries one `token` and one `BotCore`; N bots means N constructor calls |
| **Worker thread running its own bot** | a thread is a separate realm; it constructs its own instance inside the thread |
| **Custom supervisor** | you need `await bot.stop()` then re-construct on reload, or retry/backoff around boot, or migrate before boot |
| **Embedded app** | Gramstax is one subsystem of a server you already run; you mount its handler on your own listener |
| **Benchmarks / load tests** | drive many synthetic updates against a purpose-built instance |
| **Pure-JS project (no TypeScript)** | the config loader only looks for `gramstax.config.**ts**` (`src/cli/config.ts`), so a JS-only project has no config file to load |
| **`deploy: "raw"`** | no auto-start by design — you own `start()` |
| **e2e** | forces `deploy: "test"` and a silent logger; see `e2e-setup.md` |

## Pure-JS projects

`gramstax start` reads `gramstax.config.ts` and nothing else — there is no `.js` fallback. A JavaScript-only project therefore cannot be booted by the CLI at all, and must construct directly:

```javascript
// src/bot.js — plain JS, no build step, no config file
import {join} from "node:path"
import {TemplateManager} from "gramstax"
import {BotCore} from "./core/bot.js"

export const bot = new BotCore({
  token: process.env.BOT_TOKEN,
  deploy: process.env.BOT_DEPLOY ?? `polling`,
  log: true,
  templateManager: new TemplateManager({path: [join(import.meta.dirname, `pages`)]})
})
```

Use `import.meta.dirname`, not `import.meta.dir` — the latter is Bun-only and throws on plain Node.

If you want `gramstax start` to keep working here, rename the file to `gramstax.config.ts` and let it be type-checked — the CLI imports it through a TS-capable runtime, so the `.ts` extension costs nothing at runtime.

## cluster

```typescript
// src/cluster.ts — run with `bun --bun src/cluster.ts`
import {availableParallelism} from "node:os"
import {cluster} from "node:cluster"
import {join} from "node:path"
import {BotCore} from "~/core/bot"

const WORKERS = availableParallelism()

if (cluster.isPrimary) {
  for (let i = 0; i < WORKERS; i++) cluster.fork()
  cluster.on(`exit`, () => cluster.fork()) // restart a dead worker
} else {
  const id = cluster.worker?.id ?? 0
  const bot = new BotCore({
    token: process.env.BOT_TOKEN!,
    deploy: `webhook`,
    optionsDeploy: {
      webhook: {
        url: `https://bot.example.com/hook?worker=${id}`,
        secretToken: process.env.BOT_WEBHOOK_SECRET!
      }
    },
    // status server on the primary only — a port collision kills every worker
    statusServerPort: cluster.isPrimary ? 3001 : 0,
    // memory stores are PER PROCESS: sessions do not survive a worker switch
    cacheSession: {store: `memory`, ttlMs: 3_600_000, namespace: `s`},
    log: {override: {module: `./src/helpers/log.ts`, export: `LogHe`}}
  })
  void bot.ready
}
```

Delete `gramstax.config.ts` in this shape — `gramstax start` would read it, construct a *second* bot with the wrong port, and race your cluster.

Two cluster traps worth stating outright:

- **Memory caches fork per process.** With `store: 'memory'` a user's session lives in whichever worker last handled them, and Telegram can route their next update to any worker. Use a shared store for sessions.
- **Only the primary binds the status port.** `statusServerPort` is a real listen call; every worker claiming it throws `EADDRINUSE`.

## Multi-bot

```typescript
// src/multi.ts
import {BotCore} from "~/core/bot"

export const bots = await Promise.all(
  TENANTS.map(async (t) => new BotCore({
    token: t.token,
    deploy: `polling`,
    log: {override: {module: `./src/helpers/log.ts`, export: `LogHe`}},
    cacheSession: {store: `redis://localhost:6379`, ttlMs: 3_600_000, namespace: `t${t.id}`}
  }))
)
```

One namespace per tenant, or tenants overwrite each other's sessions. Each bot registers its own webhook and its own pages, so route names are isolated per instance.

## A worker thread that runs its own bot

This is **not** what `@gramstax/worker-thread` is for — see the clarification below. It is only needed when a thread must serve Telegram on its own:

```typescript
// src/workers/own-bot.ts
import {WorkerThreadInit} from "@gramstax/worker-thread"
import {BotCore} from "~/core/bot"

export class PollingWorker extends WorkerThreadInit {
  private _bot: BotCore | null = null

  async mtdStart() {
    if (this._bot) return `already running`
    this._bot = new BotCore({token: process.env.BOT_TOKEN!, deploy: `polling`, log: false})
    await this._bot.ready
    return `started`
  }

  async mtdStop() {
    await this._bot?.stop()
    this._bot = null
    return `stopped`
  }

  async onBeforeExit() {
    await this.mtdStop()
  }
}
```

`onBeforeExit` is where teardown belongs — a worker that leaks a polling loop keeps the thread alive forever.

## Clarification: `@gramstax/worker-thread` does not need this

Worth being precise, because the two are easy to conflate.

`@gramstax/worker-thread` is a **background-job runner**, not a bot-instance scaler. A worker is a plain `WorkerThreadInit` subclass; methods prefixed `mtd` become async RPC over `parentPort`, `WorkerThreadPool` manages N workers plus broadcast, and the gateway talks over Unix sockets. The work unit is an RPC call — sweep expired rows, refresh a cache — not a bot.

The main thread boots normally from the config, and workers launch from a **lifecycle hook**, not an entry file:

```typescript
// src/core/bot.ts — the config-driven way, no entry file needed
export class BotCore extends Gramstax {
  async hookAfterStart() {
    await IncrementJob.launchWorker([5000]) // 5s interval
  }
}
```

Teardown is **yours**: Gramstax knows nothing about workers, so nothing shuts them down for you. Handle it in your own signal handler:

```typescript
// src/cluster.ts or a supervisor script
process.on(`SIGINT`, async () => {
  await IncrementJob.shutdown(1_000)
  await bot.stop()
  process.exit(0)
})
```

`hookAfterStart` is fire-and-forget from Gramstax's side — nothing calls a shutdown hook because none exists. `example/1-complex` launches its worker without a matching shutdown, which is fine under `gramstax start` (process exit reaps the thread) but leaks a worker under `--watch` restarts or programmatic boot.

So a plain background job needs no programmatic construction. The CPU-parallelism intuition is right about what a worker *pool* does, but the parallelism is for jobs, not for serving more Telegram traffic — for that, scale with `cluster` (processes, shared Redis) or run separate deployments.

## Embedded in a larger app

```typescript
// mount Gramstax's update handling on your own listener
const bot = new BotCore({
  token: process.env.BOT_TOKEN!,
  deploy: `raw`, // no auto-start; you own the lifecycle
  log: false
})

Bun.serve({
  port: 8080,
  fetch: (req) => {
    if (new URL(req.url).pathname === `/telegram/webhook`) {
      return bot.handlerBotUpdate(req) // raw-mode entry: a Request in, a Response out
    }
    return myExistingRouter(req)
  }
})

await bot.bot.init() // raw mode never self-initializes
```

`raw` gives a bare grammY `Bot` with no pages, no templates, no routing — the right base when your app already has a server and you only want Gramstax's ctx/render layer. `handlerBotUpdate` is the same entry the emitted `server/worker.js` and `server/lambda.js` call; for the Lambda shape it takes the event instead of a `Request`.

## What changes versus the config path

| | Config | Programmatic |
| --- | --- | --- |
| Token / deploy / caches | `gramstax.config.ts`, `instanceof`-validated | your object, types-checked, nothing validated for you |
| Instance count | exactly 1 | N |
| `manifest` | rejected (unknown field) | supported — pass a frozen `IAppManifest` yourself |
| Ref slots | strings resolved by the CLI | you pass real instances (`CacheExternal`, `TemplateManager`) |
| Lifecycle | CLI owns start/stop | you own it, including `bot.ready` and `bot.stop()` |
| Config validation | loader enforces branch/mode agreement | none — a wrong `deploy` throws at construction instead |

The trade is real: the config loader validates shapes and catches the one-branch/`deploy` mismatch for you. Constructing directly means **you** own that check.

## Notes

- Delete `gramstax.config.ts` when you go programmatic. Leaving it invites `gramstax start` to boot a rival instance from the same source tree. A missing file is legal (the loader defaults to `{deploy: "polling"}`) but `start` then throws `Token is not valid or empty` — which is the intended safety net.
- Direct construction still requires a real `TemplateManager` for non-`raw` modes. A bare `{}` satisfies neither the type nor the runtime check — omit the field and pass a constructed manager instead.
- `hookAfterStart` is the only startup hook that runs after the bot is live; there is **no** shutdown hook, so teardown of anything you launched belongs in your own signal handler.
- Instance fields on `BotCore` are a legitimate composition seam the config cannot reach — see `example/1-complex/src/core/bot.ts`, which holds a live `CacheExternal` and overrides `createCtx`.
- `new CtxCore({ct, cacheData, cacheSession, cacheKeyboard, templateManager, temp})` is the low-level path when you override `createCtx`; the class-based pages above it keep their conveniences.
- Bot composition rules (`optionsPage`, `rateLimit`, `throttle`, `sessionLock`, status server) are in `deploy-runtime.md`.