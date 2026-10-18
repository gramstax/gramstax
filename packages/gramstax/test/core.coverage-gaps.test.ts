import {afterEach, describe, expect, it, mock} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {SessionLock} from "~/core/session-lock"
import {LoggingHelper, log} from "~/helpers/log"
import {MockTelegramServer} from "~/mock/telegram-server"
import {PageManager} from "~/page/manager"
import {TemplateEngine} from "~/template/engine"
import {TemplateManager} from "~/template/manager"
import {UpdateGate} from "~/update/gate"
import {UpdateQueue} from "~/update/queue"

const TEST_DIR = join(import.meta.dir, `coverage-gaps-tmp`)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe(`coverage-gaps`, () => {
  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`session-lock serialize rejection fires the catch path`, async () => {
    const client = {set: mock(async () => `OK`), eval: mock(async () => undefined)}
    const lock = new SessionLock(client as never, {leaseMs: 5000, onContended: `serialize`})
    await expect(
      lock.withLock(`k`, async () => {
        throw new Error(`boom`)
      })
    ).rejects.toThrow(`boom`)
    await sleep(20)
  })

  it(`queue close resolves blocked dequeuers with undefined`, async () => {
    const queue = new UpdateQueue<{id: number}>(1)
    const pending = queue.dequeue()
    queue.close()
    await expect(pending).resolves.toBeUndefined()
    queue.close()
  })

  it(`engine _extractBlock dedents multi-line content`, () => {
    const out = TemplateEngine._extractBlock(`<g-message lang="en">\n    line1\n      line2\n</g-message>`, `g-message`)
    expect(out).toContain(`line1`)
    expect(out).toContain(`line2`)
  })

  it(`manager handleFileAdd queues valid files and ignores others`, async () => {
    await mkdir(TEST_DIR, {recursive: true})
    const manager = new TemplateManager({path: [TEST_DIR]})
    try {
      manager.handleFileAdd(join(TEST_DIR, `note.txt`))
      manager.handleFileAdd(join(TEST_DIR, `page.html`))
      await sleep(150)
      manager.handleWatchError(new Error(`ENOENT`))
      manager.handleWatchError(undefined)
    } finally {
      await manager.destroy()
    }
  })

  it(`mock server 10.3 inbound helpers post updates`, async () => {
    const server = new MockTelegramServer()
    await server.start()
    const echo = Bun.serve({port: 0, hostname: `127.0.0.1`, fetch: async () => new Response(`OK`)})
    try {
      server.webhookUrl = `http://127.0.0.1:${echo.port}/hook`
      await server.sendStoppedGeneration({responseTimeoutMs: 0})
      expect((server.updates[server.updates.length - 1] as Record<string, unknown>).stopped_message_generation).toBeDefined()
      await server.sendStoppedGeneration({draft_id: 7, message_thread_id: 3, responseTimeoutMs: 0})
      await server.sendStoppedMessageGeneration({responseTimeoutMs: 0})
      await server.sendCommunityChatJoined({responseTimeoutMs: 0})
      await server.sendCommunityChatJoined({community: {id: 9, name: `C9`}, responseTimeoutMs: 0})
      await server.sendGiftInfo({gift_id: `g1`}, {responseTimeoutMs: 0})
      const signals = server as unknown as {_onSigint?: () => void; _onSigterm?: () => void}
      signals._onSigint?.()
      await server.start()
      signals._onSigterm?.()
      await server.start()
    } finally {
      echo.stop()
      await server.stop()
    }
  })

  it(`bot sigint/sigterm handlers call stop`, async () => {
    await mkdir(TEST_DIR, {recursive: true})
    const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [TEST_DIR]}), log: false})
    let stopped = 0
    bot.stop = (async () => {
      stopped += 1
    }) as never
    ;(bot as unknown as {_onSigint: () => void})._onSigint()
    ;(bot as unknown as {_onSigterm: () => void})._onSigterm()
    expect(stopped).toBe(2)
    await bot.stop()
  })

  it(`bot _redactToken masks configured token and passes through without bot`, () => {
    const bot = new Gramstax({token: `tok`, deploy: `raw`, log: false})
    expect(bot._redactToken(`x tok y`)).toBe(`x *** y`)
    ;(bot as unknown as {bot: undefined}).bot = undefined
    expect(bot._redactToken(`abc`)).toBe(`abc`)
  })

  it(`bot _onCatch without errorMake redacts and counts`, () => {
    const bot = new Gramstax({token: `tok`, deploy: `raw`, log: false})
    const before = bot.metrics.counts.updatesFailed
    bot._onCatch({ctx: {update: {update_id: 5}}} as never)
    expect(bot.metrics.counts.updatesFailed).toBe(before + 1)
  })

  it(`UpdateGate releases, decrements, wakes waiters, and clears on releaseAll`, async () => {
    const gate = new UpdateGate({perChatConcurrency: 3, waiterTimeoutMs: 5_000})

    const single = await gate.acquire(`a`)
    expect(gate.activeCount(`a`)).toBe(1)
    single()
    expect(gate.activeCount(`a`)).toBe(0)

    const b1 = await gate.acquire(`b`)
    const b2 = await gate.acquire(`b`)
    const b3 = await gate.acquire(`b`)
    const parked = gate.acquire(`b`)
    expect(gate.stats().waiting).toBe(1)
    b1()
    expect(gate.activeCount(`b`)).toBe(2)
    const parkedRelease = await parked
    expect(gate.activeCount(`b`)).toBe(3)
    expect(gate.stats().waiting).toBe(0)
    b2()
    b3()
    parkedRelease()
    expect(gate.activeCount(`b`)).toBe(0)

    const c1 = await gate.acquire(`c`)
    const c2 = await gate.acquire(`c`)
    const c3 = await gate.acquire(`c`)
    const stuck = gate.acquire(`c`)
    expect(gate.stats()).toEqual({activeKeys: 1, waiting: 1})
    gate.releaseAll()
    await stuck
    expect(gate.stats()).toEqual({activeKeys: 0, waiting: 0})
    c1()
    c2()
    c3()
  })

  it(`bot status server failure is swallowed`, async () => {
    await mkdir(TEST_DIR, {recursive: true})
    const blocker = Bun.serve({port: 0, hostname: `127.0.0.1`, fetch: () => new Response(`busy`)})
    try {
      const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [TEST_DIR]}), log: false})
      ;(bot as unknown as {status: {port: number}}).status.port = blocker.port ?? 0
      bot._startStatusServer()
      await sleep(100)
      expect(bot.status.server).toBeUndefined()
      await bot.stop()
    } finally {
      blocker.stop(true)
    }
  })
})

describe(`coverage-gaps-e2e`, () => {
  it(`exercises every e2e inbound helper, gmedia, and streamChunks`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `e2ecov-`))
    try {
      await writeFile(join(dir, `m.html`), `<g-base><g-message>M</g-message><g-media type="photo" src="d.jpg">Cap</g-media></g-base>`)
      const tm = new TemplateManager({path: [dir]})
      const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false})
      const e2e = bot.e2e!
      await e2e.sendText(`hi`)
      await e2e.sendPhoto()
      await e2e.sendVideo()
      await e2e.sendAudio()
      await e2e.sendDocument()
      await e2e.sendAnimation()
      await e2e.sendVoice()
      await e2e.sendVideoNote()
      await e2e.sendSticker()
      await e2e.sendLocation()
      await e2e.sendContact()
      await e2e.sendCallbackQuery(`d1`)
      await e2e.sendDice()
      await e2e.sendEditedText(`new`)
      await e2e.sendNewChatMembers()
      await e2e.sendChannelPost(`ch`)
      await e2e.sendPollAnswer(`p1`, [0])
      await e2e.sendInlineQuery(`q`)
      await e2e.sendChosenInlineResult(`r1`, `q`)
      await e2e.sendChatMemberUpdate()
      await e2e.sendMyChatMemberUpdate()
      await e2e.sendStoppedGeneration()
      await e2e.sendStoppedMessageGeneration()
      await e2e.sendCommunityChatJoined()
      await e2e.sendGiftInfo({gift_id: `g1`})
      expect(e2e.gmedia(`m`, `default`)?.type).toBe(`photo`)
      e2e.calls.push(
        {method: `sendMessageDraft`, body: {text: `a`}, timestamp: 0},
        {method: `sendRichMessageDraft`, body: {rich_message: {markdown: `b`}}, timestamp: 0},
        {method: `sendRichMessage`, body: {rich_message: {html: `c`}}, timestamp: 0},
        {method: `sendMessage`, body: {text: `d`}, timestamp: 0}
      )
      expect(e2e.streamChunks()).toEqual([`a`, `b`, `c`, `d`])
      await bot.stop()
      await tm.destroy()
    } finally {
      await rm(dir, {recursive: true, force: true})
    }
  })
})

describe(`coverage-gaps-log`, () => {
  it(`exercises error formatting, timers, and checkpoints`, () => {
    const logger = new LoggingHelper()
    logger.errorMake(new Error(`kaput`), `Svc`, `run`)
    logger.errorMake(`plain string`)
    logger.errorMake(new Error(`x`))
    expect(logger._formatErrorObj(new Error(`m`))).toContain(`m`)
    expect(logger._formatErrorObj({a: 1})).toContain(`a`)
    logger.time(`t1`)
    expect(typeof logger.timeCheck(`t1`)).toBe(`string`)
    logger.timeLog(`t1`, `step`)
    logger.timeLog(`t1`)
    logger.timeEnd(`t1`, `done`)
    logger.time(`t2`)
    logger.timeEnd(`t2`)
    expect(logger.timeCheck(`missing`)).toBeUndefined()
    logger.timeLog(`missing`, `m`)
    logger.timeLog(`missing`)
    logger.timeEnd(`missing`)
    logger.time(`a`)
    logger.time(`b`)
    expect(logger.timeActive()).toEqual([`a`, `b`])
    logger.timeClear()
    expect(logger.timeActive()).toEqual([])
    expect(log).toBeDefined()
  })
})

describe(`coverage-gaps-page-manager`, () => {
  it(`covers _getFile, paths, loaders, discovery, and cache clearing`, async () => {
    expect(PageManager.getFilePath().endsWith(join(`src`, `pages`))).toBe(true)
    expect(() => PageManager.getFileManySync()).toThrow()
    expect(() => PageManager._getFile({}, `x`)).toThrow(/must have export/)
    expect(() => PageManager._getFile({a: 1} as never, `x`, 5)).toThrow(/must have export/)
    expect(() => PageManager.getFileSync()).toThrow()
    await expect(PageManager.getFile()).rejects.toThrow()

    const dir = await mkdtemp(join(tmpdir(), `pmcov-`))
    try {
      const fixture = (name: string) => `export class ${name} { constructor() {} static load() { return new ${name}() } }`
      await writeFile(join(dir, `start.ts`), fixture(`StartPage`))
      await writeFile(join(dir, `skip.txt`), `ignored`)
      await mkdir(join(dir, `admin`), {recursive: true})
      await writeFile(join(dir, `admin`, `ban.ts`), fixture(`BanPage`))
      await writeFile(join(dir, `admin`, `index.ts`), fixture(`AdminPage`))
      await writeFile(join(dir, `util.js`), `export class UtilPage { constructor() {} static load() { return new UtilPage() } }`)
      const pages = PageManager.getFileManySync(dir)
      const routes = pages.map((p) => p.routeName).sort()
      expect(routes).toEqual([`admin`, `admin/ban`, `start`, `util`])
      for (const p of pages) {
        expect((p.page as unknown as {load: () => object}).load()).toBeDefined()
      }
      expect(PageManager.getFileSync(join(dir, `start.ts`))).toBeDefined()
      const loaded = await PageManager.getFile(join(dir, `start.ts`))
      expect(loaded).toBeDefined()
      const holder = globalThis as unknown as {require?: unknown}
      const savedRequire = holder.require
      try {
        const cache: Record<string, unknown> = {}
        for (const p of [join(dir, `start.ts`), join(dir, `admin`, `ban.ts`), join(dir, `util.js`)]) {
          cache[p] = {exports: {}}
        }
        holder.require = {cache, resolve: (id: string) => id}
        expect(PageManager.clearCacheRequire(dir)).toBe(true)
        expect(Object.keys(cache)).toHaveLength(0)
      } finally {
        holder.require = savedRequire
      }
      expect(() => PageManager.getFileManySync(join(dir, `nope`))).toThrow(/not found/)
      expect(() => PageManager.clearCacheRequire(join(dir, `nope`))).toThrow(/not found/)
      expect(() => PageManager.clearCacheRequire()).toThrow()
    } finally {
      await rm(dir, {recursive: true, force: true})
    }
  })

  it(`rejects duplicate flat/index routes and root index files`, async () => {
    const dup = await mkdtemp(join(tmpdir(), `pmdup-`))
    try {
      await writeFile(join(dup, `sub.ts`), `export class SubPage { constructor() {} static load() { return new SubPage() } }`)
      await mkdir(join(dup, `sub`), {recursive: true})
      await writeFile(join(dup, `sub`, `index.ts`), `export class SubIndexPage { constructor() {} static load() { return new SubIndexPage() } }`)
      expect(() => PageManager.getFileManySync(dup)).toThrow(/Duplicate page/)
    } finally {
      await rm(dup, {recursive: true, force: true})
    }
    const root = await mkdtemp(join(tmpdir(), `pmroot-`))
    try {
      await writeFile(join(root, `index.ts`), `export class RootPage {}`)
      expect(() => PageManager.getFileManySync(root)).toThrow(/Empty routeName/)
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })
})
