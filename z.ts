import {readFileSync} from "fs"

type AnyObj = Record<string, any>

const URL = `http://127.0.0.1:3000/webhook`
const TOTAL = 30_000 // jumlah request fix
const CONCURRENCY = 30_000 // kayak test kamu
const UNIQUE_CHATS = 30_000 // simulasi 5000 user (25k req => rata-rata 5 msg/user)

const base: AnyObj = JSON.parse(readFileSync(`example/2-helloworld/src/bench/update.json`, `utf8`))

function nowUnix() {
  return Math.floor(Date.now() / 1000)
}

function clone<T>(x: T): T {
  // cukup aman untuk JSON payload
  return JSON.parse(JSON.stringify(x))
}

function setChatId(update: AnyObj, chatId: number, i: number) {
  // update_id yang berubah (biar keliatan beda)
  update.update_id = i + 1

  // Coba set di jalur yang umum untuk Telegram update
  if (update.message) {
    update.message.message_id = i + 1
    update.message.date = nowUnix()
    update.message.chat = update.message.chat ?? {}
    update.message.chat.id = chatId
    update.message.from = update.message.from ?? {}
    update.message.from.id = chatId
    if (typeof update.message.text === `string`) {
      update.message.text = `hello ${i}`
    }
    return
  }

  if (update.callback_query) {
    update.callback_query.id = String(i + 1)
    update.callback_query.from = update.callback_query.from ?? {}
    update.callback_query.from.id = chatId
    if (update.callback_query.message?.chat) {
      update.callback_query.message.chat.id = chatId
    }
    return
  }

  if (update.inline_query) {
    update.inline_query.id = String(i + 1)
    update.inline_query.from = update.inline_query.from ?? {}
    update.inline_query.from.id = chatId
    return
  }

  // fallback minimal
  update.__bench_chat_id = chatId
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0
  const idx = Math.ceil(p * sorted.length) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))]
}

async function main() {
  const latencies: number[] = new Array(TOTAL)
  let next = 0
  let ok = 0
  let bad = 0

  const tStart = performance.now()

  async function worker() {
    while (true) {
      const i = next++
      if (i >= TOTAL) break

      const chatId = 100000 + (i % UNIQUE_CHATS)
      const upd = clone(base)
      setChatId(upd, chatId, i)

      const t0 = performance.now()
      const res = await fetch(URL, {
        method: `POST`,
        headers: {"Content-Type": `application/json`},
        body: JSON.stringify(upd)
      })
      const ms = performance.now() - t0
      latencies[i] = ms

      if (res.ok) ok++
      else bad++
    }
  }

  await Promise.all(Array.from({length: CONCURRENCY}, worker))

  const tEnd = performance.now()
  const totalMs = tEnd - tStart

  const sorted = [...latencies].sort((a, b) => a - b)

  const p50 = percentile(sorted, 0.5)
  const p975 = percentile(sorted, 0.975)
  const p99 = percentile(sorted, 0.99)
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length
  const max = sorted[sorted.length - 1]

  const rps = (TOTAL / totalMs) * 1000

  console.log(`\nBun bench: TOTAL=${TOTAL} CONCURRENCY=${CONCURRENCY} UNIQUE_CHATS=${UNIQUE_CHATS}`)
  console.log(`OK=${ok} BAD=${bad} time=${(totalMs / 1000).toFixed(2)}s rps=${rps.toFixed(1)}\n`)
  console.log(`Latency: p50=${p50?.toFixed(2)}ms p97.5=${p975?.toFixed(2)}ms p99=${p99?.toFixed(2)}ms avg=${avg.toFixed(2)}ms max=${max?.toFixed(2)}ms\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
