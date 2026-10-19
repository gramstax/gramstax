---
title: Update queue
description: Every field of the opt-in UpdateQueue, how backpressure differs between polling and webhook, how the per-chat gate picks its key, and how to watch a saturated queue.
icon: list
---

# Update queue

A gramstax bot processes one update at a time by default. That default is a
decision, not a limitation, and the opt-in changes it: a bounded queue in front of
the handlers plus a pool of concurrent drain loops. What it does not change is
ordering within a conversation. That is the gate's job, and it is the reason the
queue is safe to enable at all.

<Warning>
  `enabled` defaults to `false`. Absent or `false`, `deploy: "polling"` drains
  strictly sequentially, exactly as it did before the queue existed. Nothing about
  throughput changes until you say `enabled: true`.
</Warning>

[Concurrency and the update queue](/concepts/concurrency) is the design view: why the
three pieces exist and how a config field reaches the gate. This page is the
operational view: every field, every validation rule, and every number you can read
back under load.

## Turning it on

Both modes configure the same class, `UpdateQueue`, and each keeps its own
instance, so a polling queue and a webhook queue never contend with one another.

```ts
// gramstax.config.ts, deploy: "polling"
import type {GramstaxConfig} from `gramstax`

export default {
  token: process.env.BOT_TOKEN ?? ``,
  deploy: `polling`,
  optionsDeploy: {
    polling: {
      queue: {
        enabled: true,
        maxQueueSize: 5000,
        workerCount: 8,
        perChatConcurrency: 1
      }
    }
  }
} satisfies GramstaxConfig
```

```ts
// gramstax.config.ts, deploy: "webhook"
export default {
  token: process.env.BOT_TOKEN ?? ``,
  deploy: `webhook`,
  optionsDeploy: {
    webhook: {
      url: `https://bot.example.com/hook`,
      secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``,
      queue: {enabled: true, workerCount: 8}
    }
  }
} satisfies GramstaxConfig
```

`serverless`, `raw` and `test` have no queue. The platform owns the request
lifecycle, so there is nothing for an in-process pool to attach to, and
`optionsDeploy.serverless` has no `queue` key to give it.

## The fields

Every default below is the value the runtime uses when you omit the field, read
from the two construction sites in `core/bot.ts` rather than from a table.

| Field | Default | Effect |
| :---- | :------ | :----- |
| `enabled` | `false` | Opt-in switch. Nothing else is read unless this is `true` |
| `maxQueueSize` | `5000` | Bounded capacity of the ring buffer |
| `workerCount` | `8` | Concurrent in-process async loops draining the queue. Async loops, **not** OS threads |
| `perChatConcurrency` | `1` | `1` serializes each chat. `0` disables the gate and lets everything run at once |
| `blockWhenFull` | `true` | Webhook only: how a full queue answers a producer. See [backpressure](#backpressure-differs-by-mode) |
| `enqueueTimeoutMs` | `10000` | Webhook only: how long a producer waits for a slot before being rejected |
| `waiterTimeoutMs` | `30000` | How long a worker waits for a per-chat slot before bypassing the gate |
| `drainTimeoutMs` | `10000` | How long `stop()` waits for in-flight handlers before giving up |

The full type is `IUpdateQueueConfig`, and `IWebhookQueueConfig` remains as a
deprecated alias of it. Version 6 renamed `WebhookQueue` to `UpdateQueue` and
`IWebhookQueueConfig` to `IUpdateQueueConfig`; the old names still resolve to the
same object and `instanceof` works in both directions.

<Note>
  `workerCount` does not buy CPU parallelism. Each worker is an async loop on the
  same event loop, so the field is worth raising only when handlers are waiting on
  IO. A CPU-bound handler gains nothing and pays for it in interleaving.
</Note>

### What boot rejects

The config loader is strict, and the same rules apply to a hand-written
`new Gramstax({...})` because `_validateConfig` runs `checkQueue` over both branches.

| Rule | Message shape |
| :--- | :------------ |
| The section must be an object | `` `optionsDeploy.webhook.queue` must be an object `` |
| Only the eight fields above | `` unknown field `<key>` in `optionsDeploy.polling.queue` `` |
| `enabled`, `blockWhenFull` must be booleans | `` must be a boolean `` |
| `maxQueueSize`, `workerCount` must be at least `1` | `` must be a positive number `` |
| `perChatConcurrency`, `enqueueTimeoutMs`, `waiterTimeoutMs`, `drainTimeoutMs` must be non-negative | `` must be a non-negative number `` |

A failure names the file and the dotted path, so a typo in a config file fails at
`gramstax start` rather than at the first update.

<Tip>
  `waiterTimeoutMs` and `drainTimeoutMs` are validated by the config loader but not
  by `_validateConfig`, which checks `maxQueueSize`, `workerCount` and
  `enqueueTimeoutMs` only. A programmatic bot with a negative `drainTimeoutMs`
  gets it through to the dispatcher.
</Tip>

## The three pieces

| Class | File | Responsibility |
| :---- | :--- | :-------------- |
| `UpdateQueue` | `src/update/queue.ts` | A fixed-size ring buffer with blocking, non-blocking and closing semantics |
| `UpdateDispatcher` | `src/update/dispatcher.ts` | The worker pool, the drain on `stop()`, and the error boundary around each iteration |
| `UpdateGate` | `src/update/gate.ts` | Per-key concurrency, with a timeout that bypasses rather than blocks forever |

The queue itself is deliberately small. It allocates every slot up front, keeps a
head and a tail cursor that wrap modulo `maxSize`, and exposes four operations:
`enqueue` (blocks when full), `tryEnqueue` (never blocks), `dequeue` (blocks when
empty) and `close`. That is the entire surface.

The dispatcher is where the reliability lives. Its whole loop is wrapped in
`try/catch`, because a throw that escaped would end that worker for good and the
pool would shrink silently with nothing in the logs. It stores its worker promises
so `stop()` can join them, and it reports what is left rather than abandoning
updates without a trace.

## How the gate picks its key

`resolveGateKey` walks a three-step ladder, narrowest resource first, and returns
`undefined` only when the update has no `update_id` at all, in which case the
dispatcher runs it ungated.

| Step | Source | Key | Covers |
| :--- | :----- | :-- | :----- |
| 1 | `chat.id` from a message, edited message, channel post, edited channel post, business message, edited business message, guest message, or a callback query's message | `c:<id>` | All traffic for one chat, regardless of sender |
| 2 | `from.id`, or `poll_answer.voter_chat.id` for an anonymous voter, across inline queries, chosen inline results, poll answers, chat membership updates, join requests, legacy `join_request`, and a callback query with no message | `u:<id>` | Chat-less, user-originated updates |
| 3 | `update_id` | `u:<update_id>` | Everything else, each in a private slot |

<Note>
  Step 3 is a deliberate degradation toward no serialization rather than toward
  over-serialization. A poll update is the everyday case: Bot API 7.0 removed
  `Poll.user`, so a poll change carries no actor and lands on its own private slot
  instead of being grouped with every other poll change.
</Note>

The `join_request` read is a legacy compatibility path. Bot API 7.2 renamed it to
`chat_join_request` and grammY dropped the old field from `Update`, so the function
reads it defensively: a webhook body still carrying the old name gets gated by its
requester rather than falling through to step 3.

Because the gate keys on chat and not on user, two users talking to the bot in the
same group serialize against each other. That is deliberate. Session writes are
last-write-wins with no compare-and-swap, so two updates touching the same logical
resource must never run at once.

## Backpressure differs by mode

The full queue is the interesting state, and the two modes answer it differently
because Telegram's delivery semantics are different.

<Tabs>
  <Tab title="Webhook">
    `blockWhenFull: true`, the default. The request waits in `enqueue` for a free
    slot, bounded by `enqueueTimeoutMs`. If the timeout elapses the handler is
    released and answers **HTTP 429**, which Telegram reads as a retry signal and
    redelivers. Nothing is lost.

    With `blockWhenFull: false` the request does not wait at all. A full queue
    answers **HTTP 429** immediately, and a `Webhook queue full` warning is logged.

    ```ts
    queue: {enabled: true, blockWhenFull: false}
    ```
  </Tab>
  <Tab title="Polling">
    There is no drop path, and `blockWhenFull` does not apply. grammY has already
    advanced its `offset` by the time an update reaches the queue, so discarding one
    would lose it for good. Telegram cannot be asked for it again.

    A saturated polling queue therefore **always blocks the fetcher**. Delivery is
    at-least-once at the enqueue boundary and lossless once the update is queued.
  </Tab>
</Tabs>

The one loss path polling does have is shutdown, and it is counted: an update that
reaches `handleUpdate` after `stop()` closed the queue is discarded, increments
`counts.dropped`, and logs `Polling update discarded during shutdown`.

### Fetch backpressure

Once the queue is on, `getUpdates` stops asking for more than the queue can hold.
The dispatcher exposes `capacity()`, which is the queue's free slots, and polling
wraps `getUpdates` to clamp `limit` to the smallest of the caller's own ceiling,
the free capacity, and `100`. The floor is `1`.

That clamp is what makes polling degrade gracefully instead of collapsing. A full
queue asks Telegram for one update per fetch, so the backlog drains at handler speed
rather than the fetcher racing ahead into a buffer that cannot take it. A closed
queue reports capacity `0` however much physical room is left, because it accepts
nothing.

## Shutdown

`stop()` drains before anything else is torn down. It releases every parked gate
waiter, closes the queue, then races the joined worker promises against
`drainTimeoutMs`.

| Outcome | What happens |
| :------ | :----------- |
| Workers settle in time | `timedOut: false`, `residual: 0` |
| The budget elapses | `timedOut: true`, `residual` is whatever is still buffered, `counts.dropped` rises by that amount, and a `Polling drain timed out` or `Webhook drain timed out` warning is logged |

The drain never throws and `stop()` is idempotent, so a second call returns the same
promise rather than starting a second drain. Teardown waits for the drain, which
means a larger `drainTimeoutMs` delays shutdown, so it trades off against how long
your orchestrator will wait.

## Watching a saturated queue

Two accessors, both returning `null` while their own queue is disabled. A `null` on a
default install is the expected value, not a failure.

| Accessor | Returns |
| :-------- | :------ |
| `getWebhookQueueStats()` | `enabled`, `maxQueueSize`, `workerCount`, `perChatConcurrency`, `blockWhenFull`, the four `UpdateQueue.getStats()` numbers, plus `activeKeys`, `waiting` and `drainTimeoutMs` |
| `getPollingQueueStats()` | The same shape without `blockWhenFull`, and with `drainTimeoutMs` |

The four numbers from `getStats()` are the queue itself:

| Field | Meaning |
| :---- | :------ |
| `length` | Updates buffered right now |
| `maxSize` | The configured bound |
| `waitingEnqueue` | Producers currently blocked in `enqueue` |
| `waitingDequeue` | Consumers currently blocked in `dequeue` |

And the two gate numbers on top of them:

| Field | Meaning |
| :---- | :------ |
| `activeKeys` | Gate keys with at least one holder. The maps are pruned as holders release, so this tracks live keys, not historical cardinality |
| `waiting` | Updates parked in the gate for their key |

`activeKeys` is also exposed under the legacy alias `activeChats` in both HTTP
payloads, so existing scrapers keep parsing.

<Warning>
  On the webhook server, `GET /stats` reports `activeKeys` and `waiting` as `0`
  until the dispatcher is built. Before `_runWebhook` finishes wiring it there is
  no gate to report, and a `0` there means "not ready", not "idle".
</Warning>

### Over HTTP

On `deploy: "webhook"` two paths expose this. `GET /stats` carries the whole
snapshot plus a `queue` object; `GET /stats_queue` carries only the queue and gate
state, with a `timestamp`, which makes it the easier one to poll.

```json GET /stats_queue
{
  "enabled": true,
  "path": "/stats_queue",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "maxQueueSize": 5000,
  "workerCount": 8,
  "perChatConcurrency": 1,
  "blockWhenFull": true,
  "queue": {
    "length": 41,
    "maxSize": 5000,
    "waitingEnqueue": 0,
    "waitingDequeue": 8
  },
  "activeKeys": 8,
  "waiting": 0,
  "activeChats": 8
}
```

<Note>
  On `deploy: "polling"` neither path exists. The polling queue has no HTTP surface,
  which includes no `gramstax_queue_*` series on `/metrics`: the Prometheus
  exposition reads the webhook queue instance only. [Observability](/guides/observability)
  has the full metric list.
</Note>

## What to read under load

| Symptom | Where to look | What it means |
| :------ | :------------- | :------------ |
| `length` pinned at `maxSize` | `waitingEnqueue`, webhook `waiting` | Workers cannot keep up. Raise `workerCount`, or the handlers are the bottleneck |
| `length` near 0, `waitingDequeue` high | none | Healthy. Every worker is parked waiting for work, which is what an idle pool looks like |
| `waiting` high, `activeKeys` high | `perChatConcurrency` | One chat is hot. Raise the value only if the handlers for that chat tolerate reordering |
| `length` rising with `dropped` moving | `drainTimeoutMs` | The queue was saturated at shutdown. Raise the budget, or the pool is undersized |
| 429s from Telegram on webhook | `length`, `blockWhenFull` | The `enqueueTimeoutMs` budget expired. Telegram will redeliver, so nothing was lost |

## The benchmark

The repository ships `packages/gramstax/bench/bench.ts`, and the figures quoted
for the queue come from running it on a **development host** against a target of
600 users/s. They are one measurement of one machine with a mock Telegram API, not a
guarantee for your bot.

| Configuration | Throughput | p95 |
| :------------ | :--------- | :-- |
| Sequential drain | 377 users/s | 1828 ms |
| Queue, `workerCount: 8` | 601 users/s | 124 ms |

What transfers is the shape, not the numbers. Below saturation the queue is
neutral; past it, sequential draining means one slow handler sits in front of every
update behind it and that delay compounds, while the pool moves the wait out of the
critical path.

<Warning>
  Those handlers do nothing. The bench page renders a single templated message, so
  the p95 gap is the cost of serialization alone and nothing else. Your handlers
  will dominate both numbers. Run the bench against your own bot before quoting a
  figure to anyone.
</Warning>

The harness runs the path a real deployment takes: k6 as the only user generator,
driving a `MockTelegramServer` that serves the outgoing `sendMessage` and forwards
incoming updates over HTTP into the webhook, in three separate processes so nothing
shares an event loop with the code being measured. It prints offered load, handled
load, p95 and failures for the queue off and on, then the ratio.

<Info>
  Polling delivery is at-least-once at the enqueue boundary, because the client
  advances its offset when the update is buffered rather than when the handler
  finishes. A crash between those two points loses the update rather than
  replaying it. [`skipDuplicateUpdate`](/guides/configuration) is the setting that
  covers the reverse risk on any deployment where a duplicate is worse than a drop.
</Info>

## When not to enable it

- **One low-traffic instance.** The queue costs memory and a second moving part for
  no measurable gain.
- **Handlers that are long and order-dependent across chats.** Per-chat ordering is
  guaranteed, global ordering is not, and `perChatConcurrency: 0` plus your own
  ordering is still your job.
- **Serverless.** There is no queue to configure.

## Related

- [Concurrency and the update queue](/concepts/concurrency): the design view, with the config-to-gate mapping
- [Observability](/guides/observability): every metric name and label, and where queue gauges are missing
- [The session lock](/guides/session-lock): the cross-instance answer to the same ordering problem
- [Deploy modes](/concepts/deploy): which modes have an `optionsDeploy` queue branch at all
- [Configuration reference](/guides/configuration): the `queue` block in the field table
