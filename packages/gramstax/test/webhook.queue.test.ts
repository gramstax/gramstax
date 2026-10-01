import {describe, expect, it} from "bun:test"
import {WebhookQueue} from "~/webhook/queue"

describe(`WebhookQueue`, () => {
  it(`blocks enqueue when queue is full`, async () => {
    const queue = new WebhookQueue(1)
    await queue.enqueue({id: 1})

    let resolved = false
    const enqueuePromise = queue.enqueue({id: 2}).then(() => {
      resolved = true
    })

    await Promise.resolve()
    expect(resolved).toBe(false)

    const next = await queue.dequeue()
    expect(next).toEqual({id: 1})

    await enqueuePromise
    const tail = await queue.dequeue()
    expect(tail).toEqual({id: 2})
  })

  it(`rejects a blocked enqueue when the signal is already aborted`, async () => {
    const queue = new WebhookQueue(1)
    await queue.enqueue({id: 1})

    const controller = new AbortController()
    controller.abort()
    await expect(queue.enqueue({id: 2}, controller.signal)).rejects.toThrow(`enqueue aborted`)
    expect(queue.length).toBe(1)
  })

  it(`removes the waiter and rejects when abort fires while waiting`, async () => {
    const queue = new WebhookQueue(1)
    await queue.enqueue({id: 1})

    const controller = new AbortController()
    let error: Error | undefined
    const pending = queue.enqueue({id: 2}, controller.signal).catch((err: unknown) => {
      error = err as Error
    })
    await Promise.resolve()
    controller.abort()
    await pending

    expect(error?.message).toBe(`WebhookQueue enqueue aborted`)
    expect(queue.length).toBe(1)

    const next = await queue.dequeue()
    expect(next).toEqual({id: 1})
    expect(queue.length).toBe(0)
  })
})
