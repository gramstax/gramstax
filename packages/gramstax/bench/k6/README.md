# k6 webhook load test

External loader that floods a Gramstax bot webhook endpoint with realistic
Telegram `message` updates from many virtual users (`webhook-load.js`).

It replaces the in-process webhook load generator in
`../concurrent.bench.ts` (which shared the event loop with the bot under
test) with an external Go-based loader, so webhook throughput numbers are not
self-contended.

## Install k6 (Windows, this machine)

k6 v2.2.0 verified installed 2026-09-24 (`k6 version` → `k6.exe v2.2.0`).
If missing on a fresh machine, install by hand, then run:

```powershell
winget install k6 --source winget
# or: choco install k6 -y
k6 version
```

## Start the target bot first

k6 only hammers HTTP — a Gramstax bot must already be listening. Reuse the
bench's startup pattern (thin template-reply page, queue disabled):

- `deploy: "webhook:http://127.0.0.1:<port>/<path>"` (e.g. `/bench-hook`).
  k6 must POST to exactly that full URL — any other path is a 404.
- `webhookQueue: {enabled: false}` (required — see below).
- `botConfig.client.apiRoot` wired to a `MockTelegramServer` (same as
  `runWebhookLevel` in `../concurrent.bench.ts`), so `sendMessage` calls have
  somewhere to go.
- If the bot is constructed with `webhookSecretToken`, pass the same value as
  `SECRET_TOKEN` (server enforces the `X-Telegram-Bot-Api-Secret-Token`
  header with a timing-safe compare, else 401).
- Sanity check before loading: `GET http://127.0.0.1:<port>/health` → 200.
  The script's `setup()` does this probe automatically and warns on failure.

## Env knobs (`__ENV`)

| Var | Default | Meaning |
|-----|---------|---------|
| `WEBHOOK_URL` | `http://127.0.0.1:3000/bench-hook` | Exact webhook URL from `deploy` |
| `SECRET_TOKEN` | (empty = header omitted) | Must match bot `webhookSecretToken` when set |
| `VUS` | `20` | Virtual users (ramping target / pre-allocated VUs) |
| `DURATION` | `60s` (`Ns` or `Nm`, total ≤90s by default) | Total run time; split 25/50/25 ramp/hold/down (min 5s each) |
| `RATE` | (empty = off) | When set, switches to `constant-arrival-rate` (req/s) instead of ramping VUs |
| `FAIL_RATE` | `0.01` | SLO override: `http_req_failed` `rate<…` |
| `P99_MS` | `1000` | SLO override: `http_req_duration` `p(99)<…` |

Each VU POSTs `message` updates with unique chat/user ids (`500000 + __VU`,
same base as `concurrent.bench.ts`) and unique `update_id`s
(`__VU * 100000000 + __ITER + 1` — see the collision-avoidance comment in the
script). `check()` asserts HTTP 200. Thresholds codify the SLOs:
`http_req_failed` `rate<0.01`, `http_req_duration` `p(99)<1000`.

## Run commands

```powershell
# Smoke (≈15s, start the bot on :3000 with path /bench-hook first)
k6 run -e WEBHOOK_URL=http://127.0.0.1:3000/bench-hook -e VUS=2 -e DURATION=15s packages/gramstax/bench/k6/webhook-load.js

# Default SLO run (20 VUs, 60s ramp/hold/down)
k6 run -e WEBHOOK_URL=http://127.0.0.1:3000/bench-hook packages/gramstax/bench/k6/webhook-load.js

# Constant-rate flood (100 req/s for 2 minutes)
k6 run -e WEBHOOK_URL=http://127.0.0.1:3000/bench-hook -e RATE=100 -e VUS=20 -e DURATION=2m packages/gramstax/bench/k6/webhook-load.js

# With secret token + relaxed SLOs
k6 run -e WEBHOOK_URL=http://127.0.0.1:3000/bench-hook -e SECRET_TOKEN=abc123 -e FAIL_RATE=0.05 -e P99_MS=2000 packages/gramstax/bench/k6/webhook-load.js
```

Prefer `-e` env knobs over `--vus`/`--duration` flags: the script uses
`scenarios`, which reject those CLI shortcuts. Keep load runtime ≤3 minutes.

## How to read the output

- `http_req_duration`: `avg`/`p(90)`/`p(99)` of POST → 200 OK latency.
- `http_req_failed`: share of non-200 responses (401 = wrong `SECRET_TOKEN`,
  404 = wrong path in `WEBHOOK_URL`, 429/400 = queue enabled/full).
- `checks`: share of `status is 200` passes — must equal 100% for a clean run.
- Threshold lines at the end show `✓`/`✗` per SLO; any `✗` fails the run
  (non-zero exit code — CI-ready).
- `iterations` × VUs ≈ total updates delivered.

## What k6 measures vs what it does NOT

- Measures: HTTP intake-side latency (POST start → 200 OK) and intake
  throughput/failure rate under concurrent load.
- Does NOT measure: end-to-end reply delivery (whether `sendMessage` reached
  Telegram). That stays with the token-echo harness in
  `../concurrent.bench.ts`, which correlates each `bench-<uid>-<seq>` update
  text with the echoed `sendMessage` captured by `MockTelegramServer`.
- Precondition for honest numbers: the webhook queue MUST be disabled
  (`webhookQueue: {enabled: false}`), so 200 means handler-complete. With the
  queue enabled, 200 only means "enqueued" and latency numbers understate
  real handler time.
