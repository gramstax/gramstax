import {describe, expect, it} from "bun:test"
import {UpdateGate} from "../src/update/gate"

describe("UpdateGate", () => {
  it("serializes the same key", async () => {
    const gate = new UpdateGate({perChatConcurrency: 1, waiterTimeoutMs: 1000})
    const order: Array<string> = []
    const first = await gate.acquire(`c:1`)
    order.push(`a-in`)
    const second = gate.acquire(`c:1`).then((release) => {
      order.push(`b-in`)
      release()
    })
    releaseAfter(first, order, `a`)
    await second
    expect(order).toEqual([`a-in`, `a-out`, `b-in`])
  })

  it("runs different keys concurrently", async () => {
    const gate = new UpdateGate({perChatConcurrency: 1, waiterTimeoutMs: 1000})
    const order: Array<string> = []
    const r1 = await gate.acquire(`c:1`)
    const r2 = await gate.acquire(`c:2`)
    order.push(`both-in`)
    r1()
    r2()
    expect(order).toEqual([`both-in`])
  })

  it("honours perChatConcurrency > 1", async () => {
    const gate = new UpdateGate({perChatConcurrency: 2, waiterTimeoutMs: 1000})
    const r1 = await gate.acquire(`c:1`)
    const r2 = await gate.acquire(`c:1`)
    expect(gate.activeCount(`c:1`)).toBe(2)
    r1()
    r2()
  })

  it("treats an undefined key as ungated", async () => {
    const gate = new UpdateGate({perChatConcurrency: 1, waiterTimeoutMs: 50})
    const a = await gate.acquire(undefined)
    const b = await gate.acquire(undefined)
    a()
    b()
    expect(gate.stats().activeKeys).toBe(0)
  })

  it("bypasses after waiterTimeoutMs so a hung handler cannot deadlock the chat", async () => {
    const onTimeout = {count: 0}
    const gate = new UpdateGate({perChatConcurrency: 1, waiterTimeoutMs: 30, onTimeout: () => (onTimeout.count += 1)})
    const held = await gate.acquire(`c:1`)
    const started = Date.now()
    const release = await gate.acquire(`c:1`)
    expect(Date.now() - started).toBeGreaterThanOrEqual(25)
    expect(onTimeout.count).toBe(1)
    release()
    held()
  })

  it("treats perChatConcurrency 0 as gate disabled", async () => {
    const gate = new UpdateGate({perChatConcurrency: 0, waiterTimeoutMs: 1000})
    const a = await gate.acquire(`c:1`)
    const b = await gate.acquire(`c:1`)
    a()
    b()
    expect(gate.stats().waiting).toBe(0)
  })

  it("drops waiters and active entries on releaseAll", async () => {
    const gate = new UpdateGate({perChatConcurrency: 1, waiterTimeoutMs: 5000})
    const r = await gate.acquire(`c:1`)
    void gate.acquire(`c:1`)
    r()
    gate.releaseAll()
    expect(gate.stats()).toEqual({activeKeys: 0, waiting: 0})
  })
})

function releaseAfter(release: () => void, order: Array<string>, tag: string): void {
  setTimeout(() => {
    order.push(`${tag}-out`)
    release()
  }, 5)
}