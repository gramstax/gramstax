import {afterAll, beforeAll, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm, writeFile} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {Ctx} from "~/core/ctx"
import {PageManager} from "~/page/manager"
import {TemplateManager} from "~/template/manager"

const TEST_PAGES_DIR = join(import.meta.dir, `bot-lifecycle-red-pages`)
const TEST_EMPTY_DIR = join(import.meta.dir, `bot-lifecycle-red-empty`)

beforeAll(async () => {
  if (!existsSync(TEST_PAGES_DIR)) {
    await mkdir(TEST_PAGES_DIR, {recursive: true})
  }
  if (!existsSync(TEST_EMPTY_DIR)) {
    await mkdir(TEST_EMPTY_DIR, {recursive: true})
  }
})

afterAll(async () => {
  if (existsSync(TEST_PAGES_DIR)) {
    await rm(TEST_PAGES_DIR, {recursive: true, force: true})
  }
  if (existsSync(TEST_EMPTY_DIR)) {
    await rm(TEST_EMPTY_DIR, {recursive: true, force: true})
  }
})

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function createTestBot(cfg: Record<string, unknown> = {}) {
  const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
  return new Gramstax({
    token: `test`,
    deploy: `test`,
    templateManager: tm,
    log: false,
    botConfig: {
      botInfo: {
        id: 123456789,
        is_bot: true,
        first_name: `Bot`,
        username: `test_bot`
      }
    } as never,
    ...cfg
  } as never)
}

function buildText(text: string, userId: number = 123456789): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      chat: {id: userId, type: `private`},
      date: Math.floor(Date.now() / 1000),
      from: {id: userId, is_bot: false, first_name: `User`},
      text
    }
  }
}

function stubPageLoads(entries: Array<{path: string; page: typeof Ctx; routeName: string}>) {
  const orig = PageManager.getFileManySync
  PageManager.getFileManySync = () => entries
  return () => {
    PageManager.getFileManySync = orig
  }
}

describe(`F1 startup hooks are awaited in every mode`, () => {
  it(`raw mode exposes ready that resolves after hookBeforeStart`, async () => {
    let done = false
    class RawHookBot extends Gramstax {
      override async hookBeforeStart() {
        await sleep(20)
        done = true
      }
    }
    const bot = new RawHookBot({token: `x`, deploy: `raw`, log: false})
    expect(bot.ready).toBeDefined()
    await bot.ready
    expect(done).toBe(true)
  })

  it(`test mode awaits hookBeforeStart then hookAfterStart in order`, async () => {
    const order: string[] = []
    class THookBot extends Gramstax {
      override async hookBeforeStart() {
        order.push(`before`)
        await sleep(10)
        order.push(`before-done`)
      }
      override async hookAfterStart() {
        order.push(`after`)
        await sleep(10)
        order.push(`after-done`)
      }
    }
    const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
    const bot = new THookBot({token: `test`, deploy: `test`, templateManager: tm, log: false} as never)
    expect(bot.ready).toBeDefined()
    expect(bot.e2e).toBeDefined()
    await bot.ready
    expect(order).toEqual([`before`, `before-done`, `after`, `after-done`])
  })

  it(`polling onStart returns a promise that resolves after hookAfterStart`, async () => {
    const bot = createTestBot()
    const order: string[] = []
    bot.hookAfterStart = async () => {
      order.push(`after`)
      await sleep(20)
      order.push(`after-done`)
    }
    let capturedOpts: {onStart?: (info: unknown) => unknown} = {}
    bot.bot.start = async (opts: unknown) => {
      capturedOpts = opts as typeof capturedOpts
    }
    await bot._runPolling()
    await sleep(50)
    expect(capturedOpts.onStart).toBeDefined()
    order.length = 0
    await capturedOpts.onStart!({id: 1, is_bot: true, first_name: `B`, username: `u`})
    expect(order).toEqual([`after`, `after-done`])
  })
})

describe(`F2 polling startup failure routes to _onStartupError`, () => {
  it(`hookBeforeStart rejection calls _onStartupError instead of unhandled rejection`, async () => {
    const bot = createTestBot()
    bot.hookBeforeStart = async () => {
      throw new Error(`boom-before`)
    }
    let startupError: unknown
    bot._onStartupError = (error: unknown) => {
      startupError = error
    }
    await bot._runPolling()
    expect(startupError).toBeDefined()
    expect(String(startupError)).toContain(`boom-before`)
  })
})

describe(`F3 polling loop honors stop before retry and cancels backoff sleep`, () => {
  it(`does not attempt start at all when already stopped`, async () => {
    const bot = createTestBot({pollingMaxRetries: 0})
    let starts = 0
    bot.bot.start = async () => {
      starts++
      throw new Error(`down`)
    }
    bot._pollingStopped = true
    await bot._startPollingLoop({}, 0)
    expect(starts).toBe(0)
  })

  it(`stop() cancels an in-flight backoff sleep so the loop settles fast`, async () => {
    const bot = createTestBot({pollingMaxRetries: 5})
    let starts = 0
    bot.bot.start = async () => {
      starts++
      if (starts === 1) {
        throw new Error(`blip`)
      }
    }
    const p = bot._startPollingLoop({}, 0)
    await sleep(50)
    const t0 = Date.now()
    await bot.stop()
    await p
    const elapsed = Date.now() - t0
    expect(starts).toBe(1)
    expect(elapsed).toBeLessThan(800)
  })
})

describe(`F4 polling uses a fresh opts object per attempt`, () => {
  it(`does not mutate the input opts and toggles drop_pending_updates per attempt`, async () => {
    const bot = createTestBot({pollingMaxRetries: 5})
    const seen: Array<Record<string, unknown>> = []
    let n = 0
    bot.bot.start = async (opts: unknown) => {
      seen.push(opts as Record<string, unknown>)
      n++
      if (n === 1) {
        throw new Error(`blip`)
      }
    }
    const input: Record<string, unknown> = {allowed_updates: []}
    await bot._startPollingLoop(input, 0)
    expect(seen.length).toBe(2)
    expect(seen[0]!.drop_pending_updates).toBe(true)
    expect(seen[1]!.drop_pending_updates).toBe(false)
    expect(seen[0]).not.toBe(seen[1])
    expect(`drop_pending_updates` in input).toBe(false)
  })
})

describe(`F5 single traceId from _onHandle into _handleCtx`, () => {
  it(`passes one traceId through and increments the sequence once`, async () => {
    const bot = createTestBot()
    const traces: unknown[] = []
    bot.hookUpdate = (event: {traceId: unknown}) => {
      traces.push(event.traceId)
    }
    const received: unknown[] = []
    const orig = (bot as unknown as {_handleCtx: (...args: never[]) => Promise<void>})._handleCtx.bind(bot)
    ;(bot as unknown as {_handleCtx: (...args: never[]) => Promise<void>})._handleCtx = ((...args: never[]) => {
      received.push(args[3])
      return (orig as (...a: never[]) => Promise<void>)(...args)
    }) as never
    const seqBefore = bot._traceSeq
    const raw = buildText(`hi-trace`)
    delete raw.update_id
    await bot.bot.handleUpdate(raw as never)
    expect(received.length).toBe(1)
    expect(received[0]).toBeDefined()
    expect(traces[0]).toBe(received[0])
    expect(bot._traceSeq - seqBefore).toBe(1)
  })
})

describe(`F6 route ids return isAnswer ? matched : no-match`, () => {
  it(`id=6 custom route without answer reports no-match`, async () => {
    const bot = createTestBot()
    class CustomPage extends Ctx {
      static data = {name: `cbPage`, intentText: `cbPage`, intentCommandText: `cbPage`, intentCallbackQueryData: `cbPage`} as never
      async handleCustomThing() {}
    }
    bot.pages.all.cbPage = CustomPage
    bot.registerCustomRoute({name: `cbPage`, routeName: `handleCustomThing`, listenerName: `text`, event: `message:text`, filter: () => true})
    let state: string | undefined
    bot.hookAfterRoute = async (...args: NonNullable<Parameters<NonNullable<(typeof bot)[`hookAfterRoute`]>>>) => {
      const [_ctx, data] = args
      state = data!.state
    }
    await bot.bot.handleUpdate(buildText(`zzz-no-match-xyz`) as never)
    expect(state).toBe(`no-match`)
  })

  it(`id=0 chatmember route without answer reports no-match`, async () => {
    const bot = createTestBot()
    class CmPage extends Ctx {
      static data = {name: `cmPage`, intentText: `cmPage`, intentCommandText: `cmPage`, intentCallbackQueryData: `cmPage`} as never
      async handleChatMemberOutIn() {}
    }
    bot.pages.all.cmPage = CmPage
    bot.pages.routeChatMember.push({name: `cmPage`, routeName: `handleChatMemberOutIn`, type: `chatMember`, oldStatus: `left`, newStatus: `member`, filter: () => true})
    let state: string | undefined
    bot.hookAfterRoute = async (...args: NonNullable<Parameters<NonNullable<(typeof bot)[`hookAfterRoute`]>>>) => {
      const [_ctx, data] = args
      state = data!.state
    }

    const update = {
      update_id: Math.floor(Math.random() * 1000000),
      chat_member: {
        chat: {id: 1, type: `private`},
        from: {id: 1, is_bot: false, first_name: `U`},
        date: 1,
        old_chat_member: {user: {id: 2, is_bot: false, first_name: `V`}, status: `left`},
        new_chat_member: {user: {id: 2, is_bot: false, first_name: `V`}, status: `member`}
      }
    }
    await bot.bot.handleUpdate(update as never)
    expect(state).toBe(`no-match`)
  })
})

describe(`F7 session-clear runs once for non-session dispatch`, () => {
  it(`clears a pending session exactly once across id=4 and id=5 handlers`, async () => {
    class FreeA extends Ctx {
      static data = {name: `freeA`, intentText: `freeA`, intentCommandText: `freeA`, intentCallbackQueryData: `freeA`} as never
      async handleSessionFreePhoto() {}
      async handleFreeText() {
        this.temp.isAnswer = true
      }
    }
    class FreeB extends Ctx {
      static data = {name: `freeB`, intentText: `freeB`, intentCommandText: `freeB`, intentCallbackQueryData: `freeB`} as never
      async handleFreeText() {
        this.temp.isAnswer = true
      }
    }
    class Glob extends Ctx {
      static data = {name: `glob`, intentText: `glob`, intentCommandText: `glob`, intentCallbackQueryData: `glob`} as never
      async handleFree() {
        this.temp.isAnswer = true
      }
    }
    class OnceBot extends Gramstax {
      override _pageLoads() {
        return this._buildEmptyPages()
      }
    }
    const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
    const bot = new OnceBot({
      token: `test`,
      deploy: `test`,
      templateManager: tm,
      log: false,
      botConfig: {
        botInfo: {
          id: 123456789,
          is_bot: true,
          first_name: `Bot`,
          username: `test_bot`
        }
      } as never
    } as never) as Gramstax & {
      _pageSorts: (page: typeof Ctx, pages: unknown, index: number) => void
      _buildEmptyPages: () => never
    }
    const pages = bot._buildEmptyPages()
    const list: Array<{name: string; page: typeof Ctx}> = [
      {name: `freeA`, page: FreeA},
      {name: `freeB`, page: FreeB},
      {name: `glob`, page: Glob}
    ]
    list.forEach(({name, page}, index) => {
      pages.all[name] = page
      bot._pageSorts(page, pages, index)
    })
    bot.pages = {...bot.pages, ...pages}
    expect(pages.hasSessionRoutes).toBe(true)
    const method = Ctx.prototype.methodSessionFreePhoto(`freeA`)
    await bot.cacheSession.set(`123456789:123456789`, {method, params: {}})
    let clears = 0
    const origClear = bot._clearSessionOnNonSession.bind(bot)
    bot._clearSessionOnNonSession = async (ctx: never) => {
      clears++
      return origClear(ctx)
    }
    await bot.bot.handleUpdate(buildText(`unknown-random-xyz`) as never)
    expect(clears).toBe(1)
    expect(await bot.cacheSession.get(`123456789:123456789`)).toBeUndefined()
  })
})

describe(`F8 duplicate check uses final routing keys`, () => {
  it(`allows the same intent text under different language prefixes`, () => {
    class LangA extends Ctx {
      static data = {name: `langA`, intentTextMap: {en: `hello`}, intentCommandText: `langA`, intentCallbackQueryData: `langA`} as never
    }
    class LangB extends Ctx {
      static data = {name: `langB`, intentTextMap: {id: `hello`}, intentCommandText: `langB`, intentCallbackQueryData: `langB`} as never
    }
    const restore = stubPageLoads([
      {path: `a.ts`, page: LangA, routeName: `langA`},
      {path: `b.ts`, page: LangB, routeName: `langB`}
    ])
    try {
      const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
      expect(() => new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false} as never)).not.toThrow()
    } finally {
      restore()
    }
  })

  it(`still rejects the same intent text under the same language prefix`, () => {
    class LangC extends Ctx {
      static data = {name: `langC`, intentTextMap: {en: `hello`}, intentCommandText: `langC`, intentCallbackQueryData: `langC`} as never
    }
    class LangD extends Ctx {
      static data = {name: `langD`, intentTextMap: {en: `hello`}, intentCommandText: `langD`, intentCallbackQueryData: `langD`} as never
    }
    const restore = stubPageLoads([
      {path: `c.ts`, page: LangC, routeName: `langC`},
      {path: `d.ts`, page: LangD, routeName: `langD`}
    ])
    try {
      const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
      expect(() => new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false} as never)).toThrow(/intentText/)
    } finally {
      restore()
    }
  })
})

describe(`F9 callback duplicate check runs after short-id mutation`, () => {
  it(`does not reject identical raw callback data when short ids differ`, () => {
    class CbA extends Ctx {
      static data = {name: `cbA`, intentText: `cbA`, intentCommandText: `cbA`, intentCallbackQueryData: `same`} as never
      async handleCallbackQueryData() {}
    }
    class CbB extends Ctx {
      static data = {name: `cbB`, intentText: `cbB`, intentCommandText: `cbB`, intentCallbackQueryData: `same`} as never
      async handleCallbackQueryData() {}
    }
    const restore = stubPageLoads([
      {path: `cba.ts`, page: CbA, routeName: `cbA`},
      {path: `cbb.ts`, page: CbB, routeName: `cbB`}
    ])
    try {
      const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
      expect(() => new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false, optionsPage: {shortCallbackQueryData: true}} as never)).not.toThrow()
    } finally {
      restore()
    }
  })

  it(`still rejects identical callback data without short ids`, () => {
    class CbC extends Ctx {
      static data = {name: `cbC`, intentText: `cbC`, intentCommandText: `cbC`, intentCallbackQueryData: `same`} as never
      async handleCallbackQueryData() {}
    }
    class CbD extends Ctx {
      static data = {name: `cbD`, intentText: `cbD`, intentCommandText: `cbD`, intentCallbackQueryData: `same`} as never
      async handleCallbackQueryData() {}
    }
    const restore = stubPageLoads([
      {path: `cbc.ts`, page: CbC, routeName: `cbC`},
      {path: `cbd.ts`, page: CbD, routeName: `cbD`}
    ])
    try {
      const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
      expect(() => new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false} as never)).toThrow(/intentCallbackQueryData/)
    } finally {
      restore()
    }
  })
})

describe(`F10 page template is deleted after load`, () => {
  it(`removes the own template property instead of assigning undefined`, () => {
    class TplPage extends Ctx {
      static data = {name: `tplPage`, intentText: `tplPage`, intentCommandText: `tplPage`, intentCallbackQueryData: `tplPage`} as never
    }
    ;(TplPage as unknown as {template: unknown}).template = {dummy: true}
    const restore = stubPageLoads([{path: `tpl.ts`, page: TplPage, routeName: `tplPage`}])
    try {
      const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
      new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false} as never)
      expect(Object.hasOwn(TplPage, `template`)).toBe(false)
    } finally {
      restore()
    }
  })
})

describe(`F11 empty routeName is rejected`, () => {
  it(`throws for a root index.ts that yields an empty routeName`, async () => {
    const dir = join(TEST_EMPTY_DIR, `empty-route`)
    if (!existsSync(dir)) {
      await mkdir(dir, {recursive: true})
    }
    await writeFile(join(dir, `index.ts`), `export class IdxPage {}\n`)
    expect(() => PageManager.getFileManySync(dir)).toThrow(/routeName|empty|index/i)
    await rm(dir, {recursive: true, force: true})
  })
})

describe(`F12 clearCacheRequire fails clearly without a CJS require cache`, () => {
  it(`throws an ESM-aware error when require cache is unavailable`, () => {
    const g = globalThis as unknown as {require?: unknown}
    const saved = g.require
    try {
      g.require = undefined
      expect(() => PageManager.clearCacheRequire(TEST_PAGES_DIR)).toThrow(/ESM|CommonJS/)
    } finally {
      g.require = saved
    }
  })

  it(`still returns true on a normal path`, () => {
    const g = globalThis as unknown as {require?: unknown}
    const saved = g.require
    try {
      g.require = {cache: {}, resolve: (id: string) => id}
      expect(PageManager.clearCacheRequire(TEST_PAGES_DIR)).toBe(true)
    } finally {
      g.require = saved
    }
  })
})

describe(`F13 builtin filter events are recognized without a second subscription`, () => {
  it(`does not add a bot.on subscription for filter-backed builtin events`, () => {
    const bot = createTestBot()
    class SharePage extends Ctx {
      static data = {name: `sharePage`, intentText: `sharePage`, intentCommandText: `sharePage`, intentCallbackQueryData: `sharePage`} as never
      async handleUserShared() {}
    }
    bot.pages.all.sharePage = SharePage
    const onCalls: string[] = []
    const origOn = bot.bot.on.bind(bot.bot)
    bot.bot.on = ((...args: never[]) => {
      onCalls.push(String(args[0]))
      return (origOn as (...a: never[]) => unknown)(...args)
    }) as never
    bot.registerCustomRoute({name: `sharePage`, routeName: `handleUserShared`, listenerName: `usershared`, event: `message:users_shared`, filter: () => true})
    expect(onCalls.length).toBe(0)
  })
})

describe(`F14 registerCustomRoute is strict and dispatches only via id=6`, () => {
  it(`throws for an unknown page name`, () => {
    const bot = createTestBot()
    expect(() => bot.registerCustomRoute({name: `ghost`, routeName: `handleGhost`, listenerName: `text`, event: `message`, filter: () => true})).toThrow(/unknown/)
  })

  it(`logs and skips on duplicate routeName registration`, () => {
    const warnings: unknown[][] = []
    const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
    const bot = new Gramstax({
      token: `test`,
      deploy: `test`,
      templateManager: tm,
      log: {warn: (...args: unknown[]) => warnings.push(args)} as never,
      botConfig: {
        botInfo: {
          id: 123456789,
          is_bot: true,
          first_name: `Bot`,
          username: `test_bot`
        }
      } as never
    } as never)
    class DupPage extends Ctx {
      static data = {name: `dupPage`, intentText: `dupPage`, intentCommandText: `dupPage`, intentCallbackQueryData: `dupPage`} as never
      async handleDup() {}
    }
    bot.pages.all.dupPage = DupPage
    const entry = {name: `dupPage`, routeName: `handleDup`, listenerName: `text`, event: `message`, filter: () => true} as never
    bot.registerCustomRoute(entry)
    expect(() => bot.registerCustomRoute(entry)).not.toThrow()
    expect(bot.pages.routeCustom.length).toBe(1)
    expect(warnings.length).toBe(1)
    expect(String(warnings[0]![0])).toContain(`duplicate`)
  })

  it(`does not pollute free or session routing tables`, () => {
    const bot = createTestBot()
    class QuotePage extends Ctx {
      static data = {name: `quotePage`, intentText: `quotePage`, intentCommandText: `quotePage`, intentCallbackQueryData: `quotePage`} as never
      async handleQuote() {}
    }
    bot.pages.all.quotePage = QuotePage
    const before = JSON.stringify(bot.pages.routeDynamicSpesific.text)
    bot.registerCustomRoute({name: `quotePage`, routeName: `handleQuote`, listenerName: `text`, event: `message`, filter: () => true})
    expect(JSON.stringify(bot.pages.routeDynamicSpesific.text)).toBe(before)
  })
})

describe(`F15 one Ctx per update on the rateLimit path`, () => {
  it(`reuses the same Ctx instance in keyGenerator and onLimitExceeded`, async () => {
    const seenKey: unknown[] = []
    const seenLimited: unknown[] = []
    class SameCtxBot extends Gramstax {
      override hookKeyGenerator(ctx: Ctx) {
        seenKey.push(ctx)
        return `global`
      }
      override async hookRateLimited(ctx: Ctx) {
        seenLimited.push(ctx)
      }
    }
    const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
    const bot = new SameCtxBot({
      token: `test`,
      deploy: `test`,
      templateManager: tm,
      log: false,
      rateLimit: {windowMs: 60000, max: 1},
      botConfig: {
        botInfo: {
          id: 123456789,
          is_bot: true,
          first_name: `Bot`,
          username: `test_bot`
        }
      } as never
    } as never)
    await bot.bot.handleUpdate(buildText(`one`, 999001) as never)
    await bot.bot.handleUpdate(buildText(`two`, 999001) as never)
    expect(seenKey.length).toBe(2)
    expect(seenLimited.length).toBe(1)
    expect(seenLimited[0]).toBe(seenKey[1])
  })
})
