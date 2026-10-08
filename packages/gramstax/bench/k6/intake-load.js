import http from "k6/http"
import {check} from "k6"
import {Rate} from "k6/metrics"

// One VU iteration == one simulated user message. k6 is the load generator and
// talks only to the mock's intake endpoint; the mock then forwards to the bot.
const INTAKE_URL = __ENV.INTAKE_URL
if (!INTAKE_URL) {
  throw new Error(`INTAKE_URL is required (the mock's /bot<token>/__bench/intake)`)
}

const forwarded = new Rate("updates_forwarded")

export const options = {
  scenarios: {
    users: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE ?? `50`),
      timeUnit: "1s",
      duration: __ENV.DURATION ?? `20s`,
      preAllocatedVUs: Number(__ENV.VUS ?? `50`),
      maxVUs: Number(__ENV.MAX_VUS ?? `400`)
    }
  },
  thresholds: {
    "updates_forwarded": ["rate>0.99"],
    http_req_failed: ["rate<0.01"]
  }
}

export default function () {
  const updateId = (__VU * 100000000) + __ITER + 1
  const chatId = 500000 + __VU

  const response = http.post(INTAKE_URL, JSON.stringify({update: {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 1700000000,
      chat: {id: chatId, type: "private", first_name: "Bench"},
      from: {id: chatId, is_bot: false, first_name: "Bench", language_code: "en"},
      text: `bench-${__VU}-${__ITER}`
    }
  }}), {headers: {"Content-Type": "application/json"}, timeout: "30s"})

  const ok = check(response, {"intake accepted": (r) => r.status === 200 && r.json("ok") === true})
  forwarded.add(ok)
}