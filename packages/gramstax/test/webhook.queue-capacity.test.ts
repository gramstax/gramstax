import {describe, expect, it} from "bun:test"
import {UpdateQueue} from "../src"

describe("UpdateQueue capacity", () => {
  it("reports free slots shrinking as items arrive", async () => {
    const queue = new UpdateQueue<number>(10)
    expect(queue.capacity()).toBe(10)

    const pending: Array<Promise<void>> = []
    for (let i = 0; i < 4; i++) {
      pending.push(queue.enqueue(i))
    }
    // let the writes settle
    await Promise.resolve()
    expect(queue.capacity()).toBe(6)

    expect(await queue.dequeue()).toBe(0)
    expect(queue.capacity()).toBe(7)

    await Promise.all(pending)
    queue.close()
  })

  it("never reports negative capacity", async () => {
    const queue = new UpdateQueue<number>(2)
    const a = queue.enqueue(1)
    const b = queue.enqueue(2)
    const c = queue.enqueue(3) // blocks
    await Promise.resolve()
    expect(queue.capacity()).toBeGreaterThanOrEqual(0)
    queue.close()
    await Promise.allSettled([a, b, c])
  })

  it("reports full capacity after close", () => {
    const queue = new UpdateQueue<number>(5)
    queue.close()
    expect(queue.capacity()).toBe(0)
  })
})