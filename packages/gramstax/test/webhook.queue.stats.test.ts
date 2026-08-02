import {afterEach, beforeEach, describe, expect, it } from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"
import {WebhookQueue} from "~/webhook/queue"

const TEST_DIR = join(import.meta.dir, `bot_views_stats`)

class TestGramstax extends Gramstax {
  override _pageLoads() {
    return {routeStatic: {handleCommandText: {}}, routeDynamic: []} as any
  }

  setQueue(queue: WebhookQueue<any>) {
    this.webhookQueueInstance = queue
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
      templateManager,
      webhookQueue: {enabled: true, maxQueueSize: 2, workerCount: 3, perChatConcurrency: 1, blockWhenFull: true}
    })

    bot.bot = {} as any

    const queue = new WebhookQueue(2)
    await queue.enqueue({id: 1})
    bot.setQueue(queue)

    const stats = bot.getWebhookQueueStats()
    expect(stats?.enabled).toBe(true)
    expect(stats?.maxQueueSize).toBe(2)
    expect(stats?.length).toBe(1)
    expect(stats?.workerCount).toBe(3)
  })
})
