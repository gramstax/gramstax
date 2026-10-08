#!/usr/bin/env bash
# Same measurement as bench.sh, but the bot under test is raw grammy instead of
# Gramstax. grammy has no update queue, so only polling and webhook are compared.
#
# The handler does equivalent work to example/2-helloworld's StartPage: /start
# replies once, with an inline keyboard. Both bots talk to the same
# MockTelegramServer on the same port, through the same __update endpoint, and
# are scored by the same sendMessage count — so the gap is attributable to the
# framework, not to the harness.
#
# Usage: bash scripts/bench-grammy.sh [TOTAL] [VUS]

set -u
cd "$(dirname "$0")/.."

TOTAL="${1:-3000}"
VUS="${2:-50}"
TOKEN="bench-token"
PORT=56660

kill_strays() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='bun.exe'\" | Where-Object { \$_.CommandLine -match 'server-telegram|src.index.ts|grammy-bot|bench.ts|_bot.ts' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1
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
  local label="$1" mode="$2"

  kill_strays

  bun run scripts/server-telegram.ts > /tmp/gm.log 2>&1 &
  local mock_pid=$!
  sleep 3

  local bot_port
  bot_port="$(free_port)"

  BENCH_API_ROOT="http://127.0.0.1:${PORT}" \
  BENCH_MODE="$mode" \
  BENCH_BOT_PORT="$bot_port" \
    bun run scripts/grammy-bot.ts > /tmp/gb.log 2>&1 &
  local bot_pid=$!

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
    printf "%-18s NOT READY — bot log:\n" "$label"
    tail -3 /tmp/gb.log | cut -c1-120
    kill "$bot_pid" "$mock_pid" 2>/dev/null
    wait 2>/dev/null
    return 0
  fi

  local base_handled start result elapsed handled pending rate
  base_handled="$(field "$s" counts.sendMessage)"

  write_k6
  start=$(now_ms)
  k6 run --quiet /tmp/k6-script.js > /tmp/k6g.log 2>&1
  local k6_exit=$?
  result="$(await_handled "$TOTAL" "$start")"

  handled="$(field "$result" handled)"
  elapsed="$(field "$result" elapsed)"
  s="$(stat_of)"
  pending="$(field "$s" pending)"
  rate=$(bun -e 'process.stdout.write((Number(process.argv[1]) / Number(process.argv[2])).toFixed(1))' "$((handled - base_handled))" "$elapsed")

  printf "%-18s %8s /start/s   (drain %ss, handled %s/%s, pending %s, k6 %s)\n" \
    "$label" "$rate" "$elapsed" "$((handled - base_handled))" "$TOTAL" "$pending" "$k6_exit"

  kill "$bot_pid" "$mock_pid" 2>/dev/null
  wait 2>/dev/null
  return 0
}

echo "raw grammy@1.46.0 — /start throughput (${TOTAL} updates, ${VUS} VUs)"
echo "--------------------------------------------------------------------------------------"
run_one "grammy polling" polling
run_one "grammy webhook" webhook