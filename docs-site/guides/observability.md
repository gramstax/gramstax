---
title: Observability
description: The status server, the three HTTP endpoints it and the webhook server expose, and every metric name and label the Prometheus exposition emits.
icon: activity
---

# Observability

gramstax keeps its own counters. There is no client library to install, no agent to
run, and no exporter to configure: a bot that has been running for a minute is
already able to answer `/health`, `/stats` and `/metrics`. What you do with the
answer is up to you, and the counters are plain numbers in a plain object, so the
usual move is to scrape `/metrics` into Prometheus and keep `/stats` for a human
with `curl`.

Two different servers expose those endpoints, and which one answers decides what
you get. The [status server](#the-endpoint-table) can be turned on in any deploy
mode. The webhook server serves some of the same paths plus two the status server
does not. [The endpoint table](#the-endpoint-table) is the map; read it before
scrape config.

## Turning the status server on

The status server is off unless you give it a port. It is a top-level field in
[configuration](/guides/configuration), not something inside `optionsDeploy`:

```ts
// gramstax.config.ts
import type {GramstaxConfig} from `gramstax`

export default {
  token: process.env.BOT_TOKEN ?? ``,
  deploy: `polling`,
  statusServerPort: 3001
} satisfies GramstaxConfig
```

| Field | Default | Effect |
| :---- | :------ | :----- |
| `statusServerPort` | unset | The port to listen on. Unset means no status server, and `/health`, `/stats` and `/metrics` do not exist at all outside `deploy: "webhook"` |
| `statusServerHostname` | `127.0.0.1` | The interface to bind. The loopback default keeps metrics off the network |

`statusServerPort` is range-checked at boot: a value outside `0` to `65535` throws
`statusServerPort must be between 0 and 65535`. `statusServerHostname` must be a
non-empty string, and a whitespace-only value is rejected too.

<Warning>
  Both endpoints sit behind a local-only default for a reason. Set
  `statusServerHostname: "0.0.0.0"` only when the endpoint is meant to be public,
  and read [the guard](#the-secret-token-guard) first to know what that exposes.
</Warning>

## The endpoint table

Availability here means which server mounts the path, verified against the code
that serves it rather than against the docs.

| Endpoint | Deploy modes | Server | Body |
| :------- | :----------- | :----- | :--- |
| `GET /health` | any, with `statusServerPort` set | status | `{"status":"ok"}` |
| `GET /stats` | any, with `statusServerPort` set | status | The JSON snapshot of [all counters](#what-the-stats-snapshot-contains) |
| `GET /metrics` | any, with `statusServerPort` set | status | Prometheus exposition text |
| `GET /health` | `webhook` | webhook | `{"status":"ok"}` |
| `GET /stats` | `webhook` | webhook | The same snapshot **plus** a `queue` object |
| `GET /stats_queue` | `webhook` | webhook | Queue and gate state on its own, with a timestamp |
| `GET /` | `webhook` | webhook | `{"status":"OK","timestamp":…}`, a bare liveness check |
| `POST /<webhook path>` | `webhook` | webhook | The Telegram webhook handler itself |

<Note>
  `/metrics` and `/stats_queue` are exclusive. The webhook server does not mount
  `/metrics`, so a scrape against the webhook port 404s, and the status server does
  not mount `/stats_queue`, so a probe there 404s too. Point each caller at the
  server that actually owns the path.
</Note>

`raw` and `test` deploys get no webhook server, so with no `statusServerPort` they
expose nothing over HTTP at all.

### Polling and serverless

`polling` has no HTTP server of its own, which is why the status server exists as a
separate thing you switch on: it is the only way a polling bot answers a probe.
`serverless` is the same story with a different owner. The platform adapter serves
the webhook, and gramstax does not mount `/health`, `/stats` or `/metrics` there.
If you run serverless and want probes, ask the platform for them, or run
`statusServerPort` if your isolate permits a listener.

## The secret token guard

Both servers authenticate with the same header Telegram uses:
`X-Telegram-Bot-Api-Secret-Token`. The comparison is timing-safe, and the header
must match in length before it is compared at all.

On the **status server**, the guard is narrow and worth knowing exactly:

| Path | Guarded |
| :--- | :------ |
| `/health` | Never. It answers before the guard runs |
| `/stats` | Only when `optionsDeploy.webhook.secretToken` is set |
| `/metrics` | Only when `optionsDeploy.webhook.secretToken` is set |

The guard reads the **webhook** branch's secret. A `polling` deploy has no webhook
branch, so `webhook.secretToken` is undefined, and `/stats` and `/metrics` answer
whoever asks. That is correct only because the server binds `127.0.0.1` by
default.

<Warning>
  Set `statusServerHostname: "0.0.0.0"` on a polling bot and you have published an
  unauthenticated `/metrics`. Either add a `secretToken` to the webhook branch or
  keep the loopback bind and scrape from the same host.
</Warning>

On the **webhook server** the guard sits at the top of the request handler, before
any path is routed, so when a `secretToken` is configured it covers `/`, `/health`,
`/stats`, `/stats_queue` and the webhook path itself. Without a secret token the
whole server is open.

## What the stats snapshot contains

`MetricsStore.snapshot()` returns four fields. Nothing here is computed on read: the
store keeps running sums and a running maximum, and the snapshot is a copy.

| Field | Type | Meaning |
| :---- | :--- | :------ |
| `uptimeSeconds` | `number` | Seconds since the store was constructed, rounded |
| `counts` | `object` | Ten lifetime outcome counters, the table in [the counter list](#the-counter-list) |
| `byListener` | `Record<string, number>` | One entry per listener name, `text` and `callbackquerydata` being the common ones |
| `latency` | `object` | `count`, `avgMs`, `maxMs`, all `0` before the first routed update |

The webhook server adds a `queue` key holding `enabled`, the four numbers from
`UpdateQueue.getStats()` (`length`, `maxSize`, `waitingEnqueue`, `waitingDequeue`),
the effective `workerCount`, `perChatConcurrency` and `blockWhenFull`, and the gate
counters `activeKeys` and `waiting`. `activeChats` rides along as a legacy alias of
`activeKeys` so existing scrapers keep parsing. [The update queue](/guides/update-queue)
covers what each of those numbers means and how to read them.

Here is the same moment rendered both ways, so the mapping is visible rather than
described:

<CodeGroup>
```json GET /stats
{
  "uptimeSeconds": 4213,
  "counts": {
    "updatesTotal": 18420,
    "updatesFailed": 12,
    "matched": 17980,
    "noMatch": 402,
    "noHandler": 26,
    "blocked": 7,
    "timeouts": 2,
    "skippedDuplicate": 3,
    "skippedValidation": 0,
    "dropped": 0
  },
  "byListener": {
    "text": 12000,
    "callbackquerydata": 6100,
    "commandtext": 320
  },
  "latency": { "count": 18420, "avgMs": 43, "maxMs": 1912 }
}
```
```text GET /metrics
# HELP gramstax_updates_total Total updates processed
# TYPE gramstax_updates_total counter
gramstax_updates_total{listener="text"} 12000
gramstax_updates_total{listener="callbackquerydata"} 6100
gramstax_updates_total{listener="commandtext"} 320
gramstax_updates_updatesTotal_total 18420
gramstax_updates_updatesFailed_total 12
gramstax_updates_matched_total 17980
gramstax_updates_noMatch_total 402
gramstax_updates_noHandler_total 26
gramstax_updates_blocked_total 7
gramstax_updates_timeouts_total 2
gramstax_updates_skippedDuplicate_total 3
# HELP gramstax_update_duration_ms Update handler duration in milliseconds
# TYPE gramstax_update_duration_ms gauge
gramstax_update_duration_ms{quantile="avg"} 43
gramstax_update_duration_ms{quantile="max"} 1912
gramstax_uptime_seconds 4213
gramstax_queue_length 41
gramstax_queue_max_size 5000
gramstax_queue_waiting_enqueue 0
gramstax_queue_waiting_dequeue 8
```
</CodeGroup>

Both come from the same snapshot object. `/metrics` is a serialization of exactly
what `/stats` returns, plus the queue gauges.

## The metric list

Every name below is emitted by `metricsToPrometheus`, and they are the complete set.
There are exactly **two labels** in the whole exposition: `listener` and `quantile`.

| Metric | Type | Labels | Emitted when |
| :----- | :--- | :----- | :------------ |
| `gramstax_updates_total` | counter | `listener` | Once per entry in `byListener`, so one line per listener seen |
| `gramstax_updates_updatesTotal_total` | counter | none | When `counts.updatesTotal` is non-zero |
| `gramstax_updates_updatesFailed_total` | counter | none | When non-zero |
| `gramstax_updates_matched_total` | counter | none | When non-zero |
| `gramstax_updates_noMatch_total` | counter | none | When non-zero |
| `gramstax_updates_noHandler_total` | counter | none | When non-zero |
| `gramstax_updates_blocked_total` | counter | none | When non-zero |
| `gramstax_updates_timeouts_total` | counter | none | When non-zero |
| `gramstax_updates_skippedDuplicate_total` | counter | none | When non-zero |
| `gramstax_updates_skippedValidation_total` | counter | none | When non-zero |
| `gramstax_updates_dropped_total` | counter | none | When non-zero |
| `gramstax_update_duration_ms` | gauge | `quantile` (`avg`, `max`) | Only when at least one update has been routed |
| `gramstax_uptime_seconds` | gauge | none | Always |
| `gramstax_queue_length` | gauge | none | When queue stats are passed and `length` is defined |
| `gramstax_queue_max_size` | gauge | none | When queue stats are passed and `maxSize` is defined |
| `gramstax_queue_waiting_enqueue` | gauge | none | When queue stats are passed and `waitingEnqueue` is defined |
| `gramstax_queue_waiting_dequeue` | gauge | none | When queue stats are passed and `waitingDequeue` is defined |

<Note>
  The doubled-up `gramstax_updates_updatesTotal_total` is what the serializer
  produces, not a transcription slip. It builds the name from the snapshot key
  (`updatesTotal`) behind a fixed `gramstax_updates_` prefix and a `_total` suffix,
  and the ten outcome counters share that one rule. Copy the name into your alerts
  exactly as it stands.
</Note>

### Zero-valued counters are skipped

The serializer emits an outcome counter only when its value is greater than zero.
A healthy bot that has never dropped an update simply has no
`gramstax_updates_dropped_total` series, and an alert written as
`rate(gramstax_updates_dropped_total[5m]) > 0` returns no data rather than zero.

<Warning>
  Write absence-based alerts with an `or vector(0)` fallback, or as
  `absent()` checks. `gramstax_updates_skippedValidation_total` staying invisible
  means the limit never fired, which is the healthy state, not a broken exporter.
</Warning>

This is also why the counters are recorded where they are detected rather than
derived at the end. The route outcome counters are incremented after
`hookAfterRoute` runs; if the framework did not record the outcome, those counters
would sit at zero for the life of the process and, because zero is skipped, would
be invisible rather than merely wrong.

### Latency is avg and max, not percentiles

`gramstax_update_duration_ms` is a gauge with exactly two series, `quantile="avg"`
and `quantile="max"`. Both are computed from running totals: `avgMs` is a rounded
sum over the sample count, and `maxMs` is the highest single observation ever seen.
There is no reservoir and no histogram, so no p95. If you need percentiles, compute
them upstream from `histogram_quantile` on your own instrumentation of the handler.

The window measured is the routing pass in `_handleCtx`, which starts after the
context is built. Duplicate suppression, the `maxTextLength` check and context
construction all sit outside it.

### Queue gauges come from the webhook queue only

`/metrics` passes `webhook.instance.getStats()` and nothing else. On a polling bot
with a queue enabled there is no `UpdateQueue` on the webhook side, so no
`gramstax_queue_*` series is emitted at all, even though
`getPollingQueueStats()` has live numbers to report. To see the polling queue in
process, read `getPollingQueueStats()` directly.

### Ordering and headers

The serializer emits `# HELP` and `# TYPE` for `gramstax_updates_total` and for
`gramstax_update_duration_ms`. It does **not** emit them for
`gramstax_uptime_seconds` or for the four `gramstax_queue_*` gauges, which means
those series reach your scraper untyped. Prometheus accepts that and infers, but a
strict linter will flag it, so expect the noise if you run one.

Order is fixed: listener series, outcome counters, the latency block, uptime, then
the queue gauges. The body always ends with a trailing newline.

## The counter list

What each of the ten counters actually counts, and where it is incremented.

| Counter | Fires when |
| :------ | :--------- |
| `updatesTotal` | One routed update completes, in the same record that adds the listener hit and the latency sample |
| `updatesFailed` | Four distinct paths: the bot-level catch, a startup failure, a polling loop failure, and a routing error handled by `hookErrorPage` |
| `matched` | Routing resolved to a handler |
| `noMatch` | Routing found nothing for the listener |
| `noHandler` | Routing matched a page that declares no handler for the update |
| `blocked` | A contended session lock dropped the update, **or** `hookBeforeRoute` returned `false` |
| `timeouts` | Routing exceeded `updateTimeoutMs` and was raced to `UpdateTimeoutError` |
| `skippedDuplicate` | `skipDuplicateUpdate` is on and the `update_id` was already handled |
| `skippedValidation` | Text or caption longer than `maxTextLength`, which only applies when that limit is non-zero |
| `dropped` | A polling update discarded during shutdown, plus the residual buffered updates when a drain times out |

Three of these counters are silent until you configure the guard behind them, so a
missing series is not always a healthy bot:

| Counter | Guard | Default |
| :------ | :---- | :------ |
| `timeouts` | `updateTimeoutMs` | `30000`, so the watchdog race is live |
| `skippedValidation` | `maxTextLength` | `0`, and the check only runs above `0`, so it can never fire as shipped |
| `skippedDuplicate` | `skipDuplicateUpdate` | `false`, so the dedupe set is never populated |

If you alert on `skippedValidation` or `skippedDuplicate` alone you are alerting on
nothing until those two are turned on. [Configuration](/guides/configuration) has
the field table.

`blocked` is the one to read carefully, and [the session lock](/guides/session-lock)
owns half of it: the same counter absorbs a lock that could not run an update and a
`hookBeforeRoute` that deliberately said no. It is a dropped-update counter, not a
lock-specific one.

Two counters sit outside the normal route path. `updatesFailed` also absorbs
startup and polling failures, which happen once per process rather than once per
update, and a bot that failed to boot will show `updatesFailed: 1` with
`updatesTotal: 0`. `dropped` only moves at shutdown, when a drain exceeds
`drainTimeoutMs`, so it stays at zero for the healthy life of the process.

<Note>
  A rate-limited update is invisible here. The inbound limiter runs as middleware
  before gramstax routing, so a dropped update never reaches `_onHandle`: it adds to
  none of these ten counters and fires none of the route hooks. If you need to see
  it, count it in [`hookRateLimited`](/guides/rate-limiting).
</Note>

## Hooks as a second channel

Counters answer "how many". Three class hooks answer "which one", and they are the
place to send traces, audit trails and error reports.

| Hook | Fires | Payload |
| :--- | :---- | :------ |
| `hookTrace` | After every routed update | `{name, durationMs, attributes}`, where `attributes` carries `state` and `isEdit` |
| `hookUpdate` | Every routed update that did not error | `IUpdateSuccessEvent`, for the matched, no-match, no-handler and blocked states |
| `hookUpdateError` | Every dead update | `IUpdateErrorEvent`: `traceId`, `listenerName`, `state`, `error`, `durationMs`, `isEdit` |

`hookTrace` is the OTel-shaped one, and it is synchronous and not awaited. Its
`name` is the listener name, so one span per route is the default granularity
without any configuration.

```ts
export class BotCore extends Gramstax {
  override hookTrace(span: {name: string; durationMs: number; attributes: Record<string, unknown>}) {
    tracer.export(span)
  }
}
```

`IUpdateErrorEvent.state` is the field to triage on, and its five values map onto
things you can already see: `error`, `timeout`, `blocked`, `no-handler` and
`validation`. `traceId` is the Telegram `update_id` as a string, except for the two
failures raised outside routing, where it is the literal `startup` or `catch`. That
makes `traceId` the join key between a trace and an error report, and `durationMs`
the wall time from dispatch to failure, `0` when the failure predates routing.

<Note>
  A throwing hook is caught, logged and swallowed rather than allowed to break the
  update. An observability sink that fails takes the log line, not the bot.
</Note>

## Exporting the snapshot yourself

Both halves are public, so a bot can push metrics without an HTTP server at all.
`MetricsStore` is exported from the barrel alongside `metricsToPrometheus`, and the
instance behind the built-in endpoints is reachable on the bot.

```ts
import {metricsToPrometheus, type MetricsStore} from `gramstax`
```

Serializing a snapshot is pure: it reads the store, it does not touch it, and it
never throws on an empty store. That makes it safe to call from a timer.

```ts
// Push the same text a scraper would have got, on your own schedule.
const text = metricsToPrometheus(bot.metrics.snapshot())
```

<Info>
  `MetricsStore` is deliberately not a telemetry backend. The class doc says so
  directly: it exists so a snapshot can be exported to whatever metrics system you
  already run. Nothing in it is aggregated or retained over time, so the uptime
  number and the latency max are yours to keep.
</Info>

## Related

- [The session lock](/guides/session-lock): what a `blocked` count can mean beyond a deliberate abort
- [The update queue](/guides/update-queue): the queue gauges and `getStats()` in detail
- [Rate limiting](/guides/rate-limiting): the one event that never reaches these counters
- [Configuration reference](/guides/configuration): `statusServerPort` and `statusServerHostname` in the field table
- [Troubleshooting](/guides/troubleshooting): when a probe fails
