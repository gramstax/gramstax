import {describe, expect, it} from "bun:test"
import type {Update} from "grammy/types"
import {UpdateQueue} from "../src"
import {UpdateDispatcher} from "../src/update/dispatcher"

const upd = (id: number, chatId = id): Update => ({update_id: id, message: {chat: {id: chatId}, from: {id: chatId}}}) as unknown as Update

const tick = () => new Promise((r) => setTimeout(r, 5))

describe("UpdateDispatcher", () => {
  it("drains a bounded queue across N workers", async () => {
    const queue = new UpdateQueue<Update>(100)
    const seen: Array<number> = []
    const dispatcher = new UpdateDispatcher({
      queue,
      workerCount: 4,
      perChatConcurrency: 1,
      waiterTimeoutMs: 1000,
      drainTimeoutMs: 2000,
      handle: async (u) => {
        await tick()
        seen.push(u.update_id)
      },
      onError: () => {}
    })
    dispatcher.start()

    for (let i = 1; i <= 20; i++) queue.tryEnqueue(upd(i))
    const result = await dispatcher.stop()

    expect(result.residual).toBe(0)
    expect(seen.length).toBe(20)
  })

  it("never exceeds workerCount concurrent handlers", async () => {
    const queue = new UpdateQueue<Update>(100)
    let live = 0
    let peak = 0
    const dispatcher = new UpdateDispatcher({
      queue,
      workerCount: 3,
      perChatConcurrency: 0,
      waiterTimeoutMs: 100,
      drainTimeoutMs: 2000,
      handle: async () => {
        live += 1
        peak = Math.max(peak, live)
        await tick()
        live -= 1
      },
      onError: () => {}
    })
    dispatcher.start()
    for (let i = 1; i <= 12; i++) queue.tryEnqueue(upd(i, i))
    await dispatcher.stop()
    expect(peak).toBeLessThanOrEqual(3)
  })

  it("serializes same-chat updates", async () => {
    const queue = new UpdateQueue<Update>(100)
    let live = 0
    let peak = 0
    const dispatcher = new UpdateDispatcher({
      queue,
      workerCount: 4,
      perChatConcurrency: 1,
      waiterTimeoutMs: 1000,
      drainTimeoutMs: 2000,
      handle: async () => {
        live += 1
        peak = Math.max(peak, live)
        await tick()
        live -= 1
      },
      onError: () => {}
    })
    dispatcher.start()
    for (let i = 1; i <= 10; i++) queue.tryEnqueue(upd(i, 999))
    await dispatcher.stop()
    expect(peak).toBe(1)
  })

  it("keeps the pool alive when one handler throws", async () => {
    const queue = new UpdateQueue<Update>(100)
    const errors: Array<unknown> = []
    const seen: Array<number> = []
    const dispatcher = new UpdateDispatcher({
      queue,
      workerCount: 2,
      perChatConcurrency: 0,
      waiterTimeoutMs: 100,
      drainTimeoutMs: 2000,
      handle: async (u) => {
        if (u.update_id === 2) throw new Error(`boom`)
        seen.push(u.update_id)
      },
      onError: (err) => errors.push(err)
    })
    dispatcher.start()
    for (const i of [1, 2, 3, 4]) queue.tryEnqueue(upd(i))
    await dispatcher.stop()
    expect(errors.length).toBe(1)
    expect(seen.sort()).toEqual([1, 3, 4])
  })

  it("reports residual updates when drain times out", async () => {
    const queue = new UpdateQueue<Update>(100)
    const dispatcher = new UpdateDispatcher({
      queue,
      workerCount: 1,
      perChatConcurrency: 0,
      waiterTimeoutMs: 100,
      drainTimeoutMs: 40,
      handle: async () => {
        await new Promise((r) => setTimeout(r, 300))
      },
      onError: () => {}
    })
    dispatcher.start()
    for (let i = 1; i <= 6; i++) queue.tryEnqueue(upd(i))
    const result = await dispatcher.stop()
    expect(result.timedOut).toBe(true)
    expect(result.residual).toBeGreaterThan(0)
  })

  it("is safe to stop twice", async () => {
    const queue = new UpdateQueue<Update>(10)
    const dispatcher = new UpdateDispatcher({queue, workerCount: 1, perChatConcurrency: 0, waiterTimeoutMs: 50, drainTimeoutMs: 100, handle: async () => {}, onError: () => {}})
    dispatcher.start()
    await dispatcher.stop()
    await dispatcher.stop()
  })
})
