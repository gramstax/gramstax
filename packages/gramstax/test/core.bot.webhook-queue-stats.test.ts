import {afterEach, beforeEach, describe, expect, it } from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"
import {UpdateQueue} from "~/update/queue"

const TEST_DIR = join(import.meta.dir, `bot_views_stats`)

class TestGramstax extends Gramstax {
  override _pageLoads() {
    return {routeStatic: {handleCommandText: {}}, routeDynamic: []} as any
  }

  setQueue(queue: UpdateQueue<any>) {
    this.webhook.instance = queue
  }
}

describe(`Gramstax webhook queue stats`, () => {
  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})
  })

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`returns queue stats when enabled`, async () => {
    const templateManager = new TemplateManager({path: [TEST_DIR]})
    const bot = new TestGramstax({
      token: `test`,
      deploy: `test`,
      log: false,
      templateManager
    })
    ;(bot as any).webhook.queue = {enabled: true, maxQueueSize: 2, workerCount: 3, perChatConcurrency: 1, blockWhenFull: true}

    bot.bot = {} as any

    const queue = new UpdateQueue(2)
    await queue.enqueue({id: 1})
    bot.setQueue(queue)

    const stats = bot.getWebhookQueueStats()
    expect(stats?.enabled).toBe(true)
    expect(stats?.maxQueueSize).toBe(2)
    expect(stats?.length).toBe(1)
    expect(stats?.workerCount).toBe(3)
  })

  it(`keeps every old key and adds the dispatcher gate stats`, async () => {
    const templateManager = new TemplateManager({path: [TEST_DIR]})
    const bot = new TestGramstax({
      token: `test`,
      deploy: `test`,
      log: false,
      templateManager
    })
    ;(bot as any).webhook.queue = {enabled: true, maxQueueSize: 7, workerCount: 2, perChatConcurrency: 3, blockWhenFull: false}

    bot.bot = {} as any

    const queue = new UpdateQueue(10)
    await queue.enqueue({id: 1})
    bot.setQueue(queue)

    const stats = bot.getWebhookQueueStats()!

    expect(stats.enabled).toBe(true)
    expect(stats.maxQueueSize).toBe(7)
    expect(stats.workerCount).toBe(2)
    expect(stats.perChatConcurrency).toBe(3)
    expect(stats.blockWhenFull).toBe(false)
    expect(stats.length).toBe(1)
    expect(stats.maxSize).toBe(10)
    expect(stats.waitingEnqueue).toBe(0)
    expect(stats.waitingDequeue).toBe(0)

    expect(stats.activeKeys).toBe(0)
    expect(stats.waiting).toBe(0)
    expect(stats.drainTimeoutMs).toBe(10_000)

    queue.close()
  })
})
