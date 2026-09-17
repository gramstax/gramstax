import {afterAll, beforeAll, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {Ctx} from "~/core/ctx"
import {TemplateManager} from "~/template/manager"
import type {ITCt, ITCtxParams} from "~/types/t.ctx"

const TEST_PAGES_DIR = join(import.meta.dir, `ctx-plumbing-pages`)

beforeAll(async () => {
  if (!existsSync(TEST_PAGES_DIR)) {
    await mkdir(TEST_PAGES_DIR, {recursive: true})
  }
})

afterAll(async () => {
  if (existsSync(TEST_PAGES_DIR)) {
    await rm(TEST_PAGES_DIR, {recursive: true, force: true})
  }
})

class PlumbingBot extends Gramstax {
  override _pageLoads() {
    return this._buildEmptyPages()
  }
}

type FakeDb = {ping: string}

class DbBot extends PlumbingBot {
  db: FakeDb = {ping: `pong`}
  // Generic signature is required: a concrete return cannot extend the base `ITCtxParams & T` for all T.
  override buildCtxParams<T extends Record<string, unknown> = Record<string, never>>(ct: ITCt, _extra?: T): ITCtxParams & T & {db: FakeDb} {
    return super.buildCtxParams(ct, {db: this.db}) as ITCtxParams & T & {db: FakeDb}
  }
}

class DbPage extends Ctx {
  static data = {name: `dbpage`} as never
  declare db: FakeDb
  constructor(params: ITCtxParams & {db: FakeDb}) {
    super(params)
    this.db = params.db
  }
}

const BOT_INFO = {id: 123456789, is_bot: true, first_name: `Bot`, username: `test_bot`}

const makeBot = (extra: Record<string, unknown> = {}, hook?: NonNullable<ITCtxParams[`onSendError`]>): PlumbingBot => {
  const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
  const bot = new PlumbingBot({
    token: `test:token`,
    deploy: `test`,
    log: false,
    templateManager: tm,
    botConfig: {botInfo: BOT_INFO},
    ...extra
  } as never)
  if (hook !== undefined) bot.hookSendError = hook
  return bot
}

const makeCt = (): ITCt =>
  ({
    api: {config: {use: () => {}}},
    me: {id: 9, is_bot: true, first_name: `Bot`},
    update: {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}
  }) as unknown as ITCt

type BuildFn = <T extends Record<string, unknown>>(ct: ITCt, extra?: T) => ITCtxParams & T

const buildOf = (bot: PlumbingBot): BuildFn => (bot as never as {buildCtxParams: BuildFn}).buildCtxParams.bind(bot)

describe(`ctx-plumbing-builder`, () => {
  it(`returns params identical to the forwarded scope field-by-field`, () => {
    const bot = makeBot()
    const ct = makeCt()
    const params = buildOf(bot)(ct)
    expect(params.ct).toBe(ct)
    expect(params.cacheSession).toBe(bot.cacheSession)
    expect(params.cacheKeyboard).toBe(bot.cacheKeyboard)
    expect(params.templateManager).toBe(bot.templateManager)
    expect(params.log).toBe(bot.log)
    expect(params.mediaRoots).toBeNull()
    expect(params.onSendError).toBeNull()
    expect(params.temp).toEqual({isAnswer: false, session: {}, data: {}})
    expect(Object.keys(params).sort()).toEqual([`cacheKeyboard`, `cacheSession`, `ct`, `log`, `mediaRoots`, `onSendError`, `temp`, `templateManager`])
  })

  it(`preserves null-semantics per field`, () => {
    const roots = [`./a`]
    const seen: Array<{err: unknown; info: unknown}> = []
    const hook: NonNullable<ITCtxParams[`onSendError`]> = (err, info) => {
      seen.push({err, info})
    }
    const keyboard = new Map<string, unknown>()
    const bot = makeBot({mediaRoots: roots, cacheKeyboard: keyboard}, hook)
    const params = buildOf(bot)(makeCt())
    expect(params.mediaRoots).toBe(roots)
    expect(typeof params.onSendError).toBe(`function`)
    const err = new Error(`x`)
    const info = {page: `p`, kind: `fallback-text`, chatId: 1} as Parameters<NonNullable<ITCtxParams[`onSendError`]>>[1]
    params.onSendError?.(err, info)
    expect(seen).toEqual([{err, info}])
    expect(params.cacheKeyboard).toBe(keyboard)
    const nulled = makeBot({mediaRoots: null})
    const nulledParams = buildOf(nulled)(makeCt())
    expect(nulledParams.mediaRoots).toBeNull()
    expect(nulledParams.onSendError).toBeNull()
  })

  it(`builds a fresh temp per call`, () => {
    const bot = makeBot()
    const build = buildOf(bot)
    const first = build(makeCt())
    const second = build(makeCt())
    expect(first.temp).not.toBe(second.temp)
  })
})

describe(`ctx-plumbing-extra`, () => {
  const makeDbBot = (): DbBot => {
    const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
    return new DbBot({
      token: `test:token`,
      deploy: `test`,
      log: false,
      templateManager: tm,
      botConfig: {botInfo: BOT_INFO}
    } as never)
  }

  it(`does not auto-attach extra keys to Ctx`, () => {
    const bot = makeDbBot()
    const params = buildOf(bot)(makeCt())
    const ctx = new Ctx(params)
    expect((ctx as unknown as Record<string, unknown>).db).toBeUndefined()
  })

  it(`manual subclass assignment wires db with identity and typing`, () => {
    const bot = makeDbBot()
    const params = buildOf(bot)(makeCt()) as ITCtxParams & {db: FakeDb}
    expect(params.db).toBe(bot.db)
    const page = new DbPage(params)
    expect(page.db).toBe(bot.db)
    expect(page.db.ping).toBe(`pong`)
    const copy = new DbPage(page)
    expect(copy.db).toBe(bot.db)
    expect(copy.cacheSession).toBe(page.cacheSession)
    expect(copy.templateManager).toBe(page.templateManager)
  })

  it(`reserved ct and temp keys throw naming the key`, () => {
    const build = buildOf(makeBot())
    const ct = makeCt()
    expect(() => build(ct, {ct})).toThrow(`Ctx extra must not override reserved key: ct`)
    expect(() => build(ct, {temp: {isAnswer: false, session: {}, data: {}}})).toThrow(`Ctx extra must not override reserved key: temp`)
  })
})
