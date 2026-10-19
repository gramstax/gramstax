---
title: Session lock
description: Running one bot across several instances without two of them handling the same user's update at once.
icon: lock
---

# Session lock

One bot, two instances, one user taps a button. Both instances can end up
handling that user's update. Without a lock both run the handler: two replies,
two writes to the same session entry, two keyboards that disagree. `sessionLock`
takes an atomic lease on the session key so only one instance handles a given
user's update at a time.

## Why you need it

A single-instance bot does not need this. Updates drain one at a time, and
[`skipDuplicateUpdate`](/guides/configuration#reliability) covers webhook retries
on one process. Two things stop being true when you scale out:

- Duplicate suppression keeps its seen-ids in an in-process `Map` capped at
  1024 entries. Two instances each receive the same `update_id` and each decides
  it has never seen it.
- Your handler reads and writes the session cache across that whole window, so
  two concurrent handlers for one `user:chat` is a read-modify-write race: a
  wizard parks in step 2 on one instance while the other replies with step 1's
  keyboard.

<Note>
  The per-chat gate inside the update queue already serializes a single
  instance. It is process-local. The lease is what stops the instances from
  colliding with each other. See [concurrency](/concepts/concurrency).
</Note>

## Redis only

The lock is an atomic `SET NX PX` lease carrying a random token, released by a
Lua compare-and-delete so a slow holder cannot delete the lease its successor
now owns. It runs against the client underlying your session store, so there is
no second connection to configure.

That is the entire requirement: `cacheSession` must be Redis-backed. On the
default `memory` store there is nothing to take a lease on, so the lock is not
merely disabled. It logs at boot and every update runs unlocked:

```text
sessionLock requires a Redis cache backend (got memory store) — session lock disabled
```

<Warning>
  Turning `sessionLock` on while `cacheSession` is `memory` buys you nothing.
  The config validates, the bot boots, no update is ever locked, and the only
  signal is one warning line in a log you may not be reading. A memory-backed
  session store is also per-instance, so the session data is already split
  across your instances and the lease would have nothing coherent to protect.
</Warning>

## Configuration

`sessionLock` is **off unless you set it**. Once the object is present the lock
is on; `enabled: false` is how you turn it back off without deleting the block.

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `enabled` | boolean | on when the object is present | `false` disables locking even when the other fields are set |
| `leaseMs` | number | `5000` | The `PX` expiry on the lease, and the retry budget for `wait`. An instance that crashes stops holding the session once this elapses |
| `onContended` | `skip` \| `wait` \| `serialize` | `skip` | What happens when the lease is already held |
| `key` | `(ctx) => string` | `ctx.sessionKey()` | Which session key to lock, namespaced internally as `lock:<key>` so a lease can never be confused with cached session data |

By default `key` resolves to `ctx.sessionKey()`, which scopes by user id **and**
chat id, so one user in two chats holds two independent leases.

```ts
import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  cacheSession: {store: process.env.CACHE_SESSION_STORE ?? `redis://localhost:6379`},
  sessionLock: {
    enabled: true,
    leaseMs: 5000,
    onContended: `serialize`,
    key: `./src/lock-key.ts`
  }
}

export default config
```

The store URL goes inside `cacheSession.store`. A bare string there is read as
a **module path** to a `CacheExternal`, not as a URL.

`key` is the one nested path-ref in the config file. It must resolve to a plain
function taking the page context; `override.args` is rejected, because there is
nothing to construct.

<Tip>
  `leaseMs` sets two clocks: how long a lease survives, and how long `wait`
  retries. Raising it to give `wait` more patience also raises how long a dead
  instance keeps every other instance out.
</Tip>

## Where the lock sits

The lease wraps the whole dispatch for every listener, from `hookBeforeRoute`
through page routing to `hookAfterRoute`. It is a handler-level lock, not a
per-cache-operation one, so two handlers for the same session key cannot
interleave. Duplicate suppression and `maxTextLength` validation run before the
lock, so every instance still evaluates them. An update carrying neither a user
nor a chat, such as a poll update, has no session to protect and skips locking
entirely.

## Contention

| Mode | When the lease is held | Pick it when |
| --- | --- | --- |
| `skip` | The update is dropped and `blocked` increments | A duplicate is worse than a lost update: OTP codes, payment confirmation, stock mutation. The safe default |
| `wait` | Retries every 10ms until `leaseMs` elapses, then drops | Contention is rare and the update cannot be lost. Adds latency exactly when the bot is already busy |
| `serialize` | Queues behind the current holder on a per-key FIFO | The flow is order-dependent and a dropped step breaks it: wizards, checkouts, staged uploads. Nothing is lost; a slow user queues instead of disappearing |

`serialize` chains contenders onto a local per-key queue before Redis is
consulted, so ordering holds within an instance and the lease is what prevents
overlap between instances. It is the mode to reach for when a user walking
through a multi-step flow would notice a missing step. In every mode the lease
expiring is the only recovery from a holder that never comes back, so a crashed
instance costs that mode its behaviour for up to `leaseMs`.

## Metrics

A contended update the lock could not run increments `counts.blocked`. On
`GET /stats` it reads `counts.blocked`; on `GET /metrics` it is exposed as
`gramstax_updates_blocked_total` once it is non-zero.

Two things to know about that counter:

- `blocked` is shared with a `hookBeforeRoute` that returned `false`. It is a
  dropped-update counter, not a lock-specific one.
- A dropped update never reaches routing, so `hookBeforeRoute`, `hookAfterRoute`,
  `hookUpdate` and `hookTrace` do not fire for it, and it does not land in
  `updatesTotal`. Blocked updates are invisible to every hook you own.

## Serverless

`gramstax build` drops `sessionLock` from a serverless entry: it needs a Redis
client over TCP, which neither edge isolates nor a bundled lambda entry provide.

## Related

- [Concurrency and the update queue](/concepts/concurrency): the in-process counterpart
- [Configuration reference](/guides/configuration): `sessionLock` in the field table
- [`gramstax start`](/guides/gramstax-start): how `key` resolves at boot