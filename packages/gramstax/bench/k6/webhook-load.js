/*
 * Gramstax webhook flood — external k6 load script.
 *
 * Floods a Gramstax bot webhook endpoint with realistic Telegram `message`
 * updates from many virtual users. This replaces the in-process webhook load
 * generator in `packages/gramstax/bench/concurrent.bench.ts` (which shared the
 * event loop with the bot under test) with an external Go-based loader, so
 * future webhook throughput numbers are not self-contended.
 *
 * Target shape (mirrors `runWebhookLevel` in `concurrent.bench.ts`):
 * - The bot is started with `deploy: "webhook"` plus
 *   `optionsDeploy: {url: "http://127.0.0.1:3000/bench-hook"}`. k6 POSTs to exactly that
 *   `<fullUrl>` (pathname match; anything else is a 404). Pass it via
 *   `WEBHOOK_URL`. The bot also serves `GET /health` on the same origin.
 * - `Content-Type: application/json`. When the bot is constructed with the
 *   `webhookSecretToken` param, every POST must also carry the
 *   `X-Telegram-Bot-Api-Secret-Token` header or the server answers 401
 *   (timing-safe compare in `Gramstax._runWebhook`). Pass it via
 *   `SECRET_TOKEN`; the header is omitted when empty.
 * - Webhook queue MUST be disabled (`webhookQueue: {enabled: false}`), so the
 *   200 OK is sent only after the handler finishes and the measured latency is
 *   handler-complete latency, not enqueue latency.
 *
 * Collision-avoidance scheme for `update_id`:
 * - `update_id = __VU * UPDATE_ID_STRIDE + __ITER + 1` with
 *   `UPDATE_ID_STRIDE = 100000000`.
 * - (`__VU`, `__ITER`) pairs are unique within one k6 run: every VU instance
 *   has a distinct `__VU`, and `__ITER` counts that VU instance's own
 *   iterations (this holds for both executors used below). Hence every
 *   `update_id` is unique within the run. Values stay far below 2^53, so they
 *   are exact as JSON numbers.
 * - Chat/user ids are unique per VU via `USER_ID_BASE + __VU` (same
 *   `500000` base as `concurrent.bench.ts`), so per-chat serialization in the
 *   bot never collapses distinct VUs onto one chat. Message text carries a
 *   `k6-<vu>-<iter>` token mirroring the bench's `bench-<uid>-<seq>` token.
 * - NOTE: ids repeat across separate runs (same `__VU` sequence), so do not
 *   compare per-update results across runs by `update_id` alone.
 *
 * k6 scripts run in the goja ES6-subset dialect: NO TypeScript, NO npm
 * imports, only `k6/*` modules. All strings below use backticks per repo rule.
 */

import http from "k6/http"
import {check} from "k6"

const WEBHOOK_URL = __ENV.WEBHOOK_URL || `http://127.0.0.1:3000/bench-hook`
const SECRET_TOKEN = __ENV.SECRET_TOKEN || ``
const VUS = parseInt(__ENV.VUS || `20`, 10)
const RATE = parseInt(__ENV.RATE || `0`, 10)
const FAIL_RATE = __ENV.FAIL_RATE || `0.01`
const P99_MS = __ENV.P99_MS || `1000`
const USER_ID_BASE = 500000
const UPDATE_ID_STRIDE = 100000000

function parseDurationToSeconds(raw, fallbackSeconds) {
  const text = (raw || ``).trim()
  if (text === ``) {
    return fallbackSeconds
  }
  const match = text.match(/^(\d+)\s*(s|m)?$/)
  if (!match) {
    return fallbackSeconds
  }
  const value = parseInt(match[1], 10)
  return match[2] === `m` ? value * 60 : value
}

// Default total is 60s (<=90s). Overridable via DURATION, e.g. `120s`, `3m`.
const TOTAL_S = parseDurationToSeconds(__ENV.DURATION, 60)

function buildStages(totalSeconds) {
  const up = Math.max(5, Math.round(totalSeconds * 0.25))
  const down = Math.max(5, Math.round(totalSeconds * 0.25))
  const hold = Math.max(5, totalSeconds - up - down)
  return [
    {duration: `${up}s`, target: VUS},
    {duration: `${hold}s`, target: VUS},
    {duration: `${down}s`, target: 0}
  ]
}

function buildOptions() {
  const thresholds = {http_req_failed: [`rate<${FAIL_RATE}`], http_req_duration: [`p(99)<${P99_MS}`]}
  if (RATE > 0) {
    return {
      thresholds: thresholds,
      scenarios: {
        flood: {
          executor: `constant-arrival-rate`,
          rate: RATE,
          timeUnit: `1s`,
          duration: `${TOTAL_S}s`,
          preAllocatedVUs: VUS,
          maxVUs: Math.max(VUS * 10, 50)
        }
      }
    }
  }
  return {
    thresholds: thresholds,
    scenarios: {
      flood: {
        executor: `ramping-vus`,
        startVUs: 0,
        stages: buildStages(TOTAL_S),
        gracefulRampDown: `5s`
      }
    }
  }
}

export const options = buildOptions()

// Fail fast on a wrong WEBHOOK_URL, but never abort on the health probe:
// some deployments sit behind a proxy without `/health`.
export function setup() {
  const origin = WEBHOOK_URL.split(`/`).slice(0, 3).join(`/`)
  const res = http.get(`${origin}/health`, {timeout: `5s`})
  if (res.status !== 200) {
    console.warn(`k6 setup: GET ${origin}/health returned ${res.status}; is the bot webhook server up?`)
  }
  return {webhookUrl: WEBHOOK_URL}
}

export default function () {
  const vu = __VU
  const iter = __ITER
  const chatId = USER_ID_BASE + vu
  const updateId = vu * UPDATE_ID_STRIDE + iter + 1
  const payload = JSON.stringify({
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: {id: chatId, type: `private`, first_name: `K6`},
      from: {id: chatId, is_bot: false, first_name: `K6`, language_code: `en`},
      text: `k6-${vu}-${iter}`
    }
  })
  const headers = {"Content-Type": `application/json`}
  if (SECRET_TOKEN !== ``) {
    headers["X-Telegram-Bot-Api-Secret-Token"] = SECRET_TOKEN
  }
  const res = http.post(WEBHOOK_URL, payload, {headers: headers, timeout: `10s`})
  check(res, {"status is 200": (r) => r.status === 200})
}
