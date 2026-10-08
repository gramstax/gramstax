/**
 * Integrity guard for the benchmark harness in `packages/gramstax/bench/`.
 *
 * `bench.ts` dispatches on `argv[2]`, and each role is a long-running server, so
 * it cannot be imported. One mock and one bot are spawned for the whole file and
 * every assertion is a delta against the mock's cumulative counters — spawning
 * per test made this file the slowest in the suite and unreliable under load.
 *
 * The regression guarded against was silent: the harness used to POST without
 * `X-Telegram-Bot-Api-Secret-Token`, so the bot answered 401, zero updates were
 * ever processed, and the bench still printed a complete table. A string grep
 * cannot catch that, so these tests drive one update end to end and require the
 * bot to actually answer it.
 *
 * k6 is deliberately not exercised here — it adds tens of seconds and its own
 * failure modes. The plumbing between the three processes is what matters, and
 * that is fully covered below.
 *
 * @internal
 */

import {afterAll, beforeAll, describe, expect, it} from "bun:test"
import {join} from "node:path"

const ROOT = join(import.meta.dir, `..`, `..`, `..`)
const BENCH = join(ROOT, `packages`, `gramstax`, `bench`, `bench.ts`)
const TOKEN = `bench-token`
const SECRET = `bench-secret`
const BOT_PORT = 39_000 + Math.floor(Math.random() * 1_000)

type Spawned = {proc: ReturnType<typeof Bun.spawn>; stop: () => void}

const running: Spawned[] = []

// Bun's `node:child_process` shim returns an incomplete ChildProcess here (`.off`
// and `.kill` are missing), so `Bun.spawn` is used directly and its streams are
// drained with readers.
function launch(role: string, env: Record<string, string>): Spawned {
  const proc = Bun.spawn([`bun`, BENCH, role], {cwd: ROOT, env: {...process.env, ...env}, stdout: `pipe`, stderr: `pipe`})
  void new Response(proc.stderr).text()
  const handle: Spawned = {
    proc,
    stop: () => {
      // Defensive: a test that already failed on a timeout must not turn into an
      // unrelated `afterAll` crash while cleaning up.
      try {
        proc.kill()
      } catch {
        /* already gone */
      }
    }
  }
  running.push(handle)
  return handle
}

async function readLine(proc: Spawned, timeoutMs: number, match: RegExp): Promise<string> {
  const reader = (proc.proc.stdout as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let buffer = ``
  const deadline = Date.now() + timeoutMs
  try {
    while (Date.now() < deadline) {
      const chunk = await reader.read()
      if (chunk.done === true) {
        throw new Error(`child exited before emitting ${match}`)
      }
      buffer += decoder.decode(chunk.value, {stream: true})
      const lines = buffer.split(`
`)
      buffer = lines.pop() ?? ``
      for (const line of lines) {
        if (match.test(line)) {
          return line.trim()
        }
      }
    }
    throw new Error(`no line matching ${match} within ${timeoutMs}ms`)
  } finally {
    reader.cancel().catch(() => undefined)
  }
}

type Stats = {intake?: number; forwarded?: number; failed?: number; replies?: number; webhookUrl?: unknown}

async function stats(apiRoot: string): Promise<Stats> {
  const response = await fetch(`${apiRoot}/bot${TOKEN}/__bench/stats`, {method: `POST`})
  const body = (await response.json()) as {ok: boolean; result?: Stats}
  return body.result ?? {}
}

async function intake(apiRoot: string, update: unknown): Promise<{ok: boolean; description?: string; result?: Record<string, unknown>}> {
  const response = await fetch(`${apiRoot}/bot${TOKEN}/__bench/intake`, {
    method: `POST`,
    headers: {"Content-Type": `application/json`},
    body: JSON.stringify({update})
  })
  return (await response.json()) as {ok: boolean; description?: string; result?: Record<string, unknown>}
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

let apiRoot = ``
let nextUpdateId = 1

beforeAll(async () => {
  const mock = launch(`mock`, {})
  apiRoot = await readLine(mock, 60_000, /^http/)

  launch(`bot`, {BENCH_API_ROOT: apiRoot, BENCH_BOT_PORT: String(BOT_PORT), BENCH_QUEUE: `1`, BENCH_SECRET_TOKEN: SECRET})
  await readLine(running[running.length - 1] as Spawned, 60_000, /^READY/)

  for (let attempt = 0; attempt < 120; attempt++) {
    if ((await stats(apiRoot)).webhookUrl !== null && (await stats(apiRoot)).webhookUrl !== undefined) {
      return
    }
    await sleep(250)
  }
  throw new Error(`bot never registered a webhook on ${apiRoot}`)
}, 180_000)

afterAll(() => {
  for (const handle of running) {
    handle.stop()
  }
  running.length = 0
})

function message(updateId: number, chatId: number): Record<string, unknown> {
  return {
    update_id: updateId,
    message: {message_id: updateId, date: 1, chat: {id: chatId, type: `private`}, from: {id: chatId, is_bot: false, first_name: `B`}, text: `hi`}
  }
}

describe(`benchmark harness integrity`, () => {
  it(`mock role serves a live MockTelegramServer`, () => {
    expect(apiRoot).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })

  it(`bot role registers its webhook on the mock`, async () => {
    expect((await stats(apiRoot)).webhookUrl).toBe(`http://127.0.0.1:${BOT_PORT}/bench-hook`)
  })

  it(`delivers one update end to end and gets a reply back`, async () => {
    const before = await stats(apiRoot)
    const result = await intake(apiRoot, message(nextUpdateId++, 1))

    expect(result.ok).toBe(true)
    expect(result.result?.forwarded).toBe(true)

    const after = await stats(apiRoot)
    expect((after.forwarded ?? 0) - (before.forwarded ?? 0)).toBe(1)
    expect((after.failed ?? 0) - (before.failed ?? 0)).toBe(0)
    // Proves the bot ran the page and called sendMessage back through the mock,
    // which only happens when the secret token header is sent.
    expect((after.replies ?? 0) - (before.replies ?? 0)).toBe(1)
  })

  it(`rejects an update missing update_id`, async () => {
    const result = await intake(apiRoot, {message: {text: `hi`}})

    expect(result.ok).toBe(false)
    expect(result.description).toContain(`update_id`)
  })

  it(`exits non-zero when the mock is unreachable`, async () => {
    const proc = Bun.spawn([`bun`, BENCH, `bot`], {cwd: ROOT, env: {...process.env, BENCH_API_ROOT: ``}, stdout: `pipe`, stderr: `pipe`})
    const stderr = await new Response(proc.stderr).text()
    const code = await proc.exited

    expect(code).not.toBe(0)
    expect(stderr).toContain(`BENCH_API_ROOT is required`)
  })
})