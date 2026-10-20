---
title: Concurrency and the update queue
description: Why updates drain sequentially by default, and what turning the queue on actually changes.
icon: gauge
---

# Concurrency and the update queue

By default, a gramstax bot processes **one update at a time**. Concurrency has a
real cost, so it is opt-in: you enable a queue when you have measured a reason.

<Note>
  With `optionsDeploy.polling.queue` absent, `deploy: "polling"` drains strictly
  sequentially. The queue is an opt-in change, not a new default.
</Note>

## The three pieces

| Piece | What it is |
| --- | --- |
| `UpdateQueue` | A bounded FIFO. Producers enqueue; it never grows without limit. |
| `UpdateDispatcher` | A pool of concurrent in-process async loops that drain the queue. |
| `UpdateGate` | A per-key concurrency gate the dispatcher acquires before running a handler. |

The gate is what makes concurrency safe. Eight workers draining one queue would
happily run two updates from the same chat at once, and a conversation is
order-dependent: a `setSession` followed by the step it parks into would race.

<Frame caption="Producers enqueue, a pool of `workerCount` loops drains, and the gate is what keeps two updates from one chat out of each other's way.">
  <img
    src="/images/update-queue.svg"
    alt="An update flows through UpdateQueue, a bounded FIFO with maxQueueSize 5000, into UpdateDispatcher, a pool with workerCount 8, and then into UpdateGate, which holds perChatConcurrency 1 and is acquired before a handler runs. Below, a timeline shows two updates for the same gate key c:1 laid end to end so they never overlap, while a single update for c:2 runs beside both, and a side panel lists the three steps of resolveGateKey: chat.id becomes c: plus the id, from.id becomes u: plus the id, and otherwise update_id becomes u: plus the id. A final panel contrasts the queue absent default, which drains strictly sequentially, with the queue enabled, where eight workers drain in parallel but the gate still serializes each chat."
  />
</Frame>

## The gate key

`resolveGateKey` derives the key from the update, in this order:

1. `chat.id`: from a message, edited message, channel post, business message,
   guest message, or a callback query's message. Keyed `c:<id>`.
2. `from.id`: when the update has a sender but no chat. This covers inline
   queries, chosen inline results, poll answers, chat-member updates, join
   requests, and callback queries with no message. Keyed `u:<id>`.
3. `update_id`: when neither a chat nor a sender exists. A pre-checkout query
   lands here, for example. With no `update_id` either, the function returns
   `undefined` and the caller does not gate the update at all.

Everything for one chat therefore serializes regardless of which worker picks it
up.

## Configuration

The same `queue` block configures both `polling` and `webhook`; each mode keeps
its own `UpdateQueue` instance.

| Field | Default | Effect |
| --- | --- | --- |
| `enabled` | `false` | Opt-in. Absent or `false`, both modes drain sequentially. |
| `maxQueueSize` | `5000` | Bounded capacity. |
| `workerCount` | `8` | Concurrent in-process async loops, **not** OS threads. |
| `perChatConcurrency` | `1` | `1` preserves ordering per chat; `0` disables the gate entirely. |
| `blockWhenFull` | `true` | Webhook only: `false` answers with HTTP 429, so Telegram retries within its bounded retry budget. Polling ignores this field and always blocks the fetcher: its offset has already advanced, so discarding would lose the update. |
| `enqueueTimeoutMs` | `10000` | How long a blocking producer waits for a slot. |
| `waiterTimeoutMs` | `30000` | How long a worker waits for a per-chat slot. |
| `drainTimeoutMs` | `10000` | How long `stop()` waits for in-flight handlers. |

## What those fields become

The `queue` block is config. It is not the option type of either runtime class.
Each mode builds an `UpdateDispatcher` from `IUpdateDispatcherOptions`, and the
dispatcher builds its own `UpdateGate` from `IUpdateGateOptions` in its
constructor, so a config field reaches the gate by passing through the
dispatcher.

| `queue` field | `IUpdateDispatcherOptions` | `IUpdateGateOptions` |
| --- | --- | --- |
| `maxQueueSize` | `queue`: constructs the `UpdateQueue` | _none_       |
| `workerCount` | `workerCount` | _none_       |
| `perChatConcurrency` | `perChatConcurrency` | `perChatConcurrency` |
| `waiterTimeoutMs` | `waiterTimeoutMs` | `waiterTimeoutMs` |
| `drainTimeoutMs` | `drainTimeoutMs` | _none_       |
| _none_        | `handle`, `onError`: required, wired internally | _none_       |
| _none_        | `onWaiterTimeout?` | `onTimeout?` |

Only `perChatConcurrency` and `waiterTimeoutMs` reach the gate.
`maxQueueSize`, `workerCount` and `drainTimeoutMs` stop at the dispatcher;
`enabled`, `blockWhenFull` and `enqueueTimeoutMs` are consumed before it.
`handle` and `onError` are wired internally.

`onWaiterTimeout` has no config field, so a config-driven dispatcher passes
`onTimeout: undefined`; the callback exists for programmatic construction. A
`perChatConcurrency` of `0` or less makes the gate a no-op: `acquire` returns an
immediate release, so no waiter parks and no timeout fires. When the gate is
active, `onTimeout` fires only for a waiter that exceeds `waiterTimeoutMs`, and
the dispatcher proceeds ungated rather than blocking that key forever.

## Is it worth it

The bundled benchmark is at `packages/gramstax/bench/bench.ts`. It does not ship a
committed result table, so run it on your own host. The shape to look for is
simple: below saturation the queue is neutral. Past it, sequential draining makes
one slow handler delay every update behind it, while the queue moves that wait
behind a pool.

<Tip>
  Measure before enabling. The benchmark runs the same path your bot runs
  (k6 → mock → webhook → bot), so the result reflects your handlers, not a
  synthetic loop.
</Tip>

## When not to enable it

- **A bot whose handlers are long and sequential by nature.** Concurrency helps
  throughput, but it adds a queue, memory and a second moving part. If a flow
  depends on global order across chats, per-chat ordering is not enough;
  `perChatConcurrency: 0` plus your own lock is still your job.
- **A single low-traffic instance.** The queue costs memory and a second moving
  part for no measurable gain.

## Delivery semantics

Polling can redeliver an update whose Telegram offset was not acknowledged yet,
but once grammY has handed the update over, the in-memory queue is not durable: a
process crash loses it. The queue makes enqueue backpressured, not durable.

That is why [`skipDuplicateUpdate`](/guides/configuration#reliability) exists:
it drops an update whose `update_id` was already handled, which is the right
setting when a duplicate is worse than a drop.

## Observing it

`getPollingQueueStats()` and `getWebhookQueueStats()` each return `null` while
their queue is disabled, so a `null` is the expected value on a default install
rather than a failure. Both report length, capacity and per-stage wait counts,
and surface in `GET /stats` alongside the route counters.