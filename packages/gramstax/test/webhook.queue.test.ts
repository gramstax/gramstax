import {describe, it, expect} from "bun:test"
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
})
