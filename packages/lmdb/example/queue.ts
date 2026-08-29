/**
 * FIFO Queue (LmdbQueue) — use when you need a persistent job queue shared across processes / workers.
 * Why: backed by a dedicated sub-DB plus a shared `__queue_meta` counter (`__queue_seq_<name>`) for monotonic FIFO ids
 * (zero-padded sequence). `enqueue` bumps the counter in a transaction, `peek`/`size`/`clear` delegate, `dequeue`
 * reads `first()` + `delete` in one writer transaction for at-least-once semantics. Contention is serialized by LMDB's
 * single writer; a crash between read and delete may redeliver (documented).
 *
 * Run with: `bun run packages/lmdb/example/queue.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbQueue} from "../src/queue"
import {LmdbSchema, t} from "../src/schema"

class JobSchema extends LmdbSchema {
  static db = `jobs`
  static key = t.string()
  static value = {
    id: t.string(),
    task: t.string()
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-queue-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    const queue = new LmdbQueue(env, JobSchema)

    console.log(`--- Queue: enqueue -> peek -> dequeue (FIFO) ---\n`)
    const id1 = await queue.enqueue({id: `j1`, task: `email-welcome`})
    const id2 = await queue.enqueue({id: `j2`, task: `generate-invoice`})
    const id3 = await queue.enqueue({id: `j3`, task: `send-push`})
    console.log(`  enqueued:`, id1, id2, id3)
    console.log(`  size:`, await queue.size())

    console.log(`\n  peek (no remove):`, await queue.peek())
    console.log(`  size still:`, await queue.size())

    console.log(`\n  dequeue (FIFO):`, await queue.dequeue())
    console.log(`  dequeue:`, await queue.dequeue())
    console.log(`  size after 2 dequeues:`, await queue.size())

    console.log(`\n--- Enqueue after dequeue preserves FIFO ---\n`)
    await queue.enqueue({id: `j4`, task: `cleanup`})
    console.log(`  peek:`, await queue.peek())
    console.log(`  size:`, await queue.size())

    console.log(`\n--- Clear ---\n`)
    await queue.clear()
    console.log(`  size after clear:`, await queue.size())
    console.log(`  dequeue empty:`, await queue.dequeue())
    console.log(`  peek empty:`, await queue.peek())

    await env.close()
    console.log(`\nenv closed cleanly`)
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
