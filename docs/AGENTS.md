# Gramstax API Reference — Production Features

## ITGramstaxParams (production-relevant options)

| Param | Type | Default | Description |
|---|---|---|---|
| `deploy` | `string` | — | `polling` \| `webhook:<url>` \| `serverless:<adapter>` \| `test` \| `raw` |
| `autoRetry` | `boolean` | `true` | Enable `@grammyjs/auto-retry` on the API client |
| `autoRetryOptions` | `{maxRetryAttempts?, retryOnInternalServerErrors?}` | `{}` | Forwarded to the auto-retry plugin (backoff policy) |
| `updateTimeoutMs` | `number` | `30000` | Watchdog per update; `0` disables. On timeout: state `timeout`, metrics, `onUpdateError` |
| `skipDuplicateUpdate` | `boolean` | `false` | Skip updates with a previously seen `update_id` (bounded LRU of 1024) |
| `webhookSecretToken` | `string` | — | Checked against `X-Telegram-Bot-Api-Secret-Token`; mismatch → `401` |
| `maxTextLength` | `number` | `0` | Skip `message.text`/`caption` longer than this (`0` = unlimited) |
| `pollingMaxRetries` | `number` | `5` | Consecutive polling failures before giving up; `-1` = retry forever (exponential backoff 1s→60s) |
| `onUpdateError` | `(event) => void` | — | Structured error hook `{traceId, listenerName, state, error, durationMs, isEdit}` |
| `onUpdate` | `(event) => void` | — | Structured success hook `{traceId, listenerName, state, durationMs, isEdit}` |
| `statusServerPort` | `number` | — | Serves `GET /health` + `GET /stats` in any deploy mode |
| `statusServerHostname` | `string` | `127.0.0.1` | Bind host for the status server (keep private) |
| `webhookQueue` | `ITWebhookQueueConfig` | — | See below |
| `templateManager` | `TemplateManager` | auto | Custom template manager; supports `onReload` option |
| `cacheSession` | `CacheExternal` | memory 24h TTL | Session backend (use Redis for multi-instance) |

## ITWebhookQueueConfig

| Param | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Queue-based webhook processing with worker pool |
| `maxQueueSize` | `number` | `5000` | Bounded FIFO (ring buffer, O(1)) |
| `workerCount` | `number` | `8` | Concurrent in-process workers |
| `perChatConcurrency` | `number` | `1` | Max concurrent updates per chat (`0` disables) |
| `blockWhenFull` | `boolean` | `true` | Block request until a slot frees (else `429`) |
| `enqueueTimeoutMs` | `number` | `10000` | Max wait for a slot when `blockWhenFull`; then `429` |

## TemplateManager option

| Param | Type | Description |
|---|---|---|
| `onReload` | `() => void` | Called after a template file is (re)compiled; used to invalidate dependent caches (Gramstax clears its keyboard cache automatically) |

## Ctx broadcast options

`renderBroadcast` / `renderBroadcastMedia` extra trailing args:

- `chunkSize: number | null` — pause every N sends (extra throttle beyond the built-in 30)
- `chunkDelayMs: number | null` — pause duration per chunk (default `500`)
- `excludeIds: number[] | null` — skip these user ids (opt-out); counted in `skippedCount`

Result: `{successCount, failedCount, totalCount, skippedCount}` (throws with `err` when `throwError` and failures exist).

## HTTP endpoints

- `GET /health` — liveness `{status: "ok"}` (webhook server + status server)
- `GET /stats` — metrics snapshot `{uptimeSeconds, counts, byListener, latency}` + queue stats (webhook server + status server)
- `GET /stats_queue` — legacy webhook-only queue stats

## MetricsStore

Exposed as `bot.metrics` (`MetricsStore`). Counters: `updatesTotal`, `updatesFailed`, `matched`, `noMatch`, `noHandler`, `blocked`, `timeouts`, `skippedDuplicate`, `skippedValidation`; per-listener hit counts; latency `{count, avgMs, maxMs}`; `startedAt`. Snapshot via `bot.metrics.snapshot()` (JSON-serializable).

## Trace ids

Each update gets a lightweight trace id: `u<update_id>` (or `c<seq>` when `update_id` is missing). Included in `onUpdateError` / `onUpdate` events.

## Lifecycle

`stop()` drains in order: remove signal listeners → `bot.stop()` → close webhook queue → destroy TemplateManager (watchers) → clear keyboard cache → stop webhook/status servers. Idempotent.
