---
title: Concurrency and the update queue
description: Why updates drain sequentially by default, and what turning the queue on actually changes.
---

# Concurrency and the update queue

By default, a gramstax bot processes **one update at a time**. That is not a
simplification left over from an earlier design. It is the default because
concurrency is a decision with a real cost, and the framework refuses to make it
for you.

<Note>
  With `optionsDeploy.polling.queue` absent, `deploy: "polling"` drains strictly
  sequentially, exactly as it did before the queue existed. Turning it on is a
  measured change, not a recommended default.
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

## The gate key

`resolveGateKey` derives the key from the update, in this order:

1. `chat.id`: from a message, edited message, channel post, business message,
   guest message, or a callback query's message. Keyed `c:<id>`.
2. `from.id`: when there is no chat at all, which is the case for inline queries
   and pre-checkout queries. User-originated updates serialize per user.

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
| `blockWhenFull` | `true` | Webhook only: `false` answers the request with HTTP 429 so Telegram redelivers it. Polling ignores this field and always blocks the fetcher: its offset has already advanced, so discarding would lose the update for good. |
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

Two consequences worth stating plainly. The gate is configured by **two** of the
eight fields, not by the block as a whole: `workerCount` and `drainTimeoutMs`
stop at the dispatcher. And `handle` / `onError` are required members with no
config counterpart at all; the two construction sites supply them as the
dispatcher's wiring to the bot.

`onWaiterTimeout` is the one field with no writer. Neither mode passes it, so
`onTimeout` is `undefined` for any config-driven bot: the optional callback
exists for programmatic construction only.

At the gate, `perChatConcurrency` is read as `<= 0`, which returns a no-op release
immediately; `onTimeout` then fires for every waiter that gave up, and the
dispatcher proceeds ungated rather than blocking that key forever.

## Is it worth it

The bundled benchmark targets 600 users/s:

| Configuration | Throughput | p95 |
| --- | --- | --- |
| Sequential drain | 377 users/s | 1828 ms |
| Queue, `workerCount: 8` | 601 users/s | **124 ms** |

Below saturation the queue is neutral. The p95 difference is the point: sequential
draining means one slow handler sits in front of every update behind it, and that
delay compounds. The queue moves that wait behind a pool.

<Tip>
  Measure before enabling. `bench/bench.ts` runs the same path your bot runs (
  k6 → mock → webhook → bot), so the numbers reflect your handlers, not a
  synthetic loop.
</Tip>

## When not to enable it

- **A bot whose handlers are long and sequential by nature.** Concurrency helps
  throughput and hurts nothing else here, but if a flow depends on global order
  across chats, `perChatConcurrency: 0` plus your own ordering is still your job.
- **A single low-traffic instance.** The queue costs memory and a second moving
  part for no measurable gain.

## At-least-once delivery

Polling delivery is at-least-once at the enqueue boundary: the client advances its
offset when the update is buffered, not when the handler finishes. A crash between
those two points loses the update rather than replaying it.

That is why [`skipDuplicateUpdate`](/guides/configuration#reliability) exists:
it drops an update whose `update_id` was already handled, which is the right
setting for any deployment where a duplicate is worse than a drop.

## Observing it

`getPollingQueueStats()` and `getWebhookQueueStats()` each return `null` while
their queue is disabled, so a `null` is the expected value on a default install
rather than a failure. Both report length, capacity and per-stage wait counts,
and surface in `GET /stats` alongside the route counters.