import {describe, expect, it} from "bun:test"
import type {IUpdateQueueConfig, IWebhookQueueConfig} from "../src"
import {UpdateQueue, WebhookQueue} from "../src"

describe(`rename aliases`, () => {
  it(`UpdateQueue and WebhookQueue are the same class`, () => {
    expect(WebhookQueue).toBe(UpdateQueue)
    expect(new WebhookQueue<number>(1)).toBeInstanceOf(UpdateQueue)
  })

  it(`the legacy constructor still validates maxSize`, () => {
    expect(() => new WebhookQueue<number>(0)).toThrow()
  })

  it(`the legacy config type accepts the new config type`, () => {
    const legacy: IWebhookQueueConfig = {maxQueueSize: 10, workerCount: 4} satisfies IUpdateQueueConfig
    expect(legacy.maxQueueSize).toBe(10)
  })

  it(`the new queue is constructible through the barrel`, () => {
    expect(new UpdateQueue<string>(2).length).toBe(0)
  })
})
