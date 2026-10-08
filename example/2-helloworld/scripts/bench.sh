#!/usr/bin/env bash
# How many /start messages per second can example/2-helloworld handle?
#
# All four deploy/queue combinations:
#   polling            no optionsDeploy at all (out-of-the-box scaffold)
#   polling + queue    optionsDeploy.polling.queue
#   webhook            optionsDeploy.webhook without a queue
#   webhook + queue    optionsDeploy.webhook.queue
#
# Flow is the real one, no synthetic shortcuts:
#
#   k6 --POST /bot<token>/__update--> MockTelegramServer --> Gramstax bot
#
# The bot drains asynchronously in polling mode, so comparing k6's offered rate
# against anything would be dishonest. Each round fires TOTAL updates and times
# how long until the bot has rendered all of them, counted by the mock's
# sendMessage calls — /start commands actually finished.
#
# Usage: bash scripts/bench.sh [TOTAL] [VUS]

set -u
cd "$(dirname "$0")/.."

TOTAL="${1:-3000}"
VUS="${2:-50}"
TOKEN="bench-token"
PORT=56660
WORKERS="${BENCH_WORKERS:-8}"
PER_CHAT="${BENCH_PER_CHAT:-1}"

kill_strays() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='bun.exe'\" | Where-Object { \$_.CommandLine -match 'server-telegram|src.index.ts|bench.ts|_bot.ts' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1
  sleep 2
}

free_port() {
  bun -e 'const s = Bun.serve({port: 0, fetch: () => new Response("ok")}); const p = s.port; s.stop(true); process.stdout.write(String(p))'
}

now_ms() {
  bun -e 'process.stdout.write(String(Date.now()))'
}

stat_of() {
  curl -s -m 10 -X POST "http://127.0.0.1:${PORT}/bot${TOKEN}/__stats" -d '{}' \
    | bun -e 'const j = JSON.parse(await Bun.stdin.text()).result ?? {}; process.stdout.write(JSON.stringify(j))'
}

field() {
  bun -e 'const j = JSON.parse(process.argv[1]); const v = process.argv[2].split(".").reduce((a, k) => a?.[k], j ?? {}); process.stdout.write(String(v ?? 0))' "$1" "$2"
}

# One process polls until the bot has rendered TOTAL replies, so the wait costs a
# single startup instead of one per iteration.
await_handled() {
  bun -e '
const url = process.argv[1]
const target = Number(process.argv[2])
const start = Number(process.argv[3])
let last = 0
while (Date.now() - start < 240000) {
  try {
    const r = await fetch(url, {method: "POST"})
    const j = await r.json()
    last = j?.result?.counts?.sendMessage ?? 0
    if (last >= target) break
  } catch {}
  await Bun.sleep(150)
}
process.stdout.write(JSON.stringify({handled: last, elapsed: (Date.now() - start) / 1000}))
' "http://127.0.0.1:${PORT}/bot${TOKEN}/__stats" "$1" "$2"
}

# No update_id is sent: Telegram assigns it, and so does the mock.
write_k6() {
  cat <<JS > /tmp/k6-script.js
import http from "k6/http"
import {check} from "k6"

const URL = "http://127.0.0.1:${PORT}/bot${TOKEN}/__update"

export const options = {
  scenarios: {
    burst: {executor: "shared-iterations", vus: ${VUS}, iterations: ${TOTAL}, maxDuration: "180s"}
  },
  thresholds: {http_req_failed: ["rate<0.01"]}
}

export default function () {
  const chatId = 500000 + __VU
  const response = http.post(URL, JSON.stringify({update: {message: {
    message_id: (__VU * 100000000) + __ITER + 1,
    date: 1700000000,
    chat: {id: chatId, type: "private", first_name: "Bench"},
    from: {id: chatId, is_bot: false, first_name: "Bench", language_code: "en"},
    text: "/start",
    entities: [{type: "bot_command", offset: 0, length: 6}]
  }}}), {headers: {"Content-Type": "application/json"}, timeout: "60s"})
  check(response, {"injected": (r) => r.status === 200 && r.json("ok") === true})
}
JS
}

run_one() {
  local label="$1" mode="$2" queue="$3"

  kill_strays

  bun run scripts/server-telegram.ts > /tmp/bm.log 2>&1 &
  local mock_pid=$!
  sleep 3

  local bot_port
  bot_port="$(free_port)"

  BENCH_API_ROOT="http://127.0.0.1:${PORT}" \
  BENCH_MODE="$mode" \
  BENCH_QUEUE="$queue" \
  BENCH_BOT_PORT="$bot_port" \
  BENCH_WORKERS="$WORKERS" \
  BENCH_PER_CHAT="$PER_CHAT" \
    bun run src/index.ts > /tmp/bb.log 2>&1 &
  local bot_pid=$!

  # Readiness differs per mode: polling proves itself with getUpdates traffic,
  # webhook with a registered setWebhook.
  local ready=0 s
  for _ in $(seq 1 60); do
    s="$(stat_of)"
    if [ "$mode" = "webhook" ]; then
      local hook
      hook="$(field "$s" webhookUrl)"
      if [ "$hook" != "null" ] && [ -n "$hook" ]; then ready=1; break; fi
    else
      if [ "$(field "$s" counts.getUpdates)" -gt 0 ] 2>/dev/null; then ready=1; break; fi
    fi
    sleep 0.5
  done

  if [ "$ready" != "1" ]; then
    printf "%-16s NOT READY — bot log:\n" "$label"
    tail -3 /tmp/bb.log | cut -c1-120
    kill "$bot_pid" "$mock_pid" 2>/dev/null
    wait 2>/dev/null
    return 0
  fi

  local base_handled base_served start result elapsed handled served pending rate
  base_handled="$(field "$s" counts.sendMessage)"
  base_served="$(field "$s" served)"

  write_k6
  start=$(now_ms)
  k6 run --quiet /tmp/k6-script.js > /tmp/k6.log 2>&1
  local k6_exit=$?
  result="$(await_handled "$TOTAL" "$start")"

  handled="$(field "$result" handled)"
  elapsed="$(field "$result" elapsed)"
  s="$(stat_of)"
  served=$(( $(field "$s" served) - base_served ))
  pending="$(field "$s" pending)"
  rate=$(bun -e 'process.stdout.write((Number(process.argv[1]) / Number(process.argv[2])).toFixed(1))' "$((handled - base_handled))" "$elapsed")

  printf "%-16s %8s /start/s   (drain %ss, handled %s/%s, served %s, pending %s, k6 %s)\n" \
    "$label" "$rate" "$elapsed" "$((handled - base_handled))" "$TOTAL" "$served" "$pending" "$k6_exit"

  kill "$bot_pid" "$mock_pid" 2>/dev/null
  wait 2>/dev/null
  return 0
}

echo "example/2-helloworld — /start throughput (${TOTAL} updates, ${VUS} VUs, workers=${WORKERS}, perChat=${PER_CHAT})"
echo "-----------------------------------------------------------------------------------------------"
run_one "polling"        polling 0
run_one "polling+queue"  polling 1
run_one "webhook"        webhook 0
run_one "webhook+queue"  webhook 1