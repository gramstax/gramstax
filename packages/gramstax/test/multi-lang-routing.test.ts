import {describe, expect, it, mock} from "bun:test"
import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {Ctx} from "~/core/ctx"
import {TemplateManager} from "~/template/manager"
import type {ITPageData} from "~/types/t.ctx"


function makePages() {
  const listRouteStatic = [
    `handleCallbackQueryData`,
    `handleText`,
    `handleCommandText`,
    `handleCaptionPhoto`,
    `handleCommandCaptionPhoto`,
    `handleCaptionVideo`,
    `handleCommandCaptionVideo`,
    `handleCaptionAudio`,
    `handleCommandCaptionAudio`,
    `handleCaptionDocument`,
    `handleCommandCaptionDocument`,
    `handleCaptionAnimation`,
    `handleCommandCaptionAnimation`,
    `handleCaptionVoice`,
    `handleCommandCaptionVoice`
  ] as const
  const listRouteStaticIntent = [
    `handleArgsCallbackQueryData`,
    `handleArgsText`,
    `handleCommandArgsText`,
    `handleCaptionArgsPhoto`,
    `handleCommandCaptionArgsPhoto`,
    `handleCaptionArgsVideo`,
    `handleCommandCaptionArgsVideo`,
    `handleCaptionArgsAudio`,
    `handleCommandCaptionArgsAudio`,
    `handleCaptionArgsDocument`,
    `handleCommandCaptionArgsDocument`,
    `handleCaptionArgsAnimation`,
    `handleCommandCaptionArgsAnimation`,
    `handleCaptionArgsVoice`,
    `handleCommandCaptionArgsVoice`
  ] as const
  const makeObject = <const T extends readonly string[], V extends () => any>(keys: T, val: V): {[K in T[number]]: ReturnType<V>} =>
    Object.fromEntries(keys.map((k) => [k, val()])) as any

  return {
    all: {} as Record<string, typeof Ctx>,
    routeDynamic: [] as string[],
    routeDynamicSpesific: {
      text: [] as {name: string; routeName: string}[],
      photo: [] as {name: string; routeName: string}[],
      video: [] as {name: string; routeName: string}[],
      audio: [] as {name: string; routeName: string}[],
      document: [] as {name: string; routeName: string}[],
      animation: [] as {name: string; routeName: string}[],
      voice: [] as {name: string; routeName: string}[],
      videonote: [] as {name: string; routeName: string}[],
      sticker: [] as {name: string; routeName: string}[],
      location: [] as {name: string; routeName: string}[],
      contact: [] as {name: string; routeName: string}[]
    },
    routeStatic: makeObject(listRouteStatic, () => ({}) as Record<string, {name: string; routeName: string}>),
    routeStaticIntent: makeObject(listRouteStaticIntent, () => ({}) as Record<string, {name: string; routeName: string}>),
    routeStaticSession: {},
    routeChatMember: [] as Array<any>,
    listRouteStatic,
    listRouteStaticIntent,
    listRouteStaticSession: [],
    listRouteDynamicSpesific: [],
    lenListRouteStatic: listRouteStatic.length,
    lenListRouteStaticIntent: listRouteStaticIntent.length,
    lenListRouteStaticSession: 0,
    lenListRouteDynamicSpesific: 0
  }
}

function makePageData(overrides?: Partial<ITPageData<any>>): ITPageData<any> {
  return {
    name: `test`,
    intentText: `test`,
    intentCommandText: `test`,
    intentCallbackQueryData: `test`,
    callbackQueryData() {return `test`},
    _positionArgText: 1,
    ...overrides
  } as ITPageData<any>
}

function makePage(name: string, data: ITPageData<any>) {
  const page = class extends Ctx {
    static data = data
    static template = ``
  }
  Object.defineProperty(page, `name`, {value: name})
  return page as unknown as typeof Ctx
}

// ── TestGramstax —— exposes _pageSorts ─────────────────────────────

class TestGramstax extends Gramstax {
  constructor() {
    const tmpDir = mkdtempSync(join(tmpdir(), `gramstax-test-`))
    const tm = new TemplateManager({path: [tmpDir]})
    super({token: `test`, deploy: `test`, log: false, templateManager: tm})
    ;(this as any).bot = {api: {getMyCommands: mock(() => []), setMyCommands: mock(() => true)}}
  }

  callPageSorts(Page: typeof Ctx, pages: any, indexPage: number = 0) {
    this._pageSorts(Page, pages, indexPage)
  }

  callPageLoads(pagesPath?: string) {
    return this._pageLoads(pagesPath)
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe(`_pageSorts multi-language`, () => {
  it(`registers language-prefixed keys in routeStatic.handleText when intentTextMap is set`, () => {
    const data = makePageData({
      name: `balance`,
      intentText: `Balance`,
      intentTextMap: {default: `Balance`, en: `Balance`, id: `Saldo`}
    })
    const Page = makePage(`BalancePage`, data)
    // Add handler method so _pageSorts registers it
    ;(Page.prototype as any).handleText = async () => {}

    const pages = makePages()
    const bot = new TestGramstax()
    bot.callPageSorts(Page, pages as any, 0)

    const ht = pages.routeStatic.handleText
    expect(ht[`default:Balance`]).toEqual({name: `balance`, routeName: `handleText`})
    expect(ht[`en:Balance`]).toEqual({name: `balance`, routeName: `handleText`})
    expect(ht[`id:Saldo`]).toEqual({name: `balance`, routeName: `handleText`})
    // Plain key should NOT be set when intentTextMap is present
    expect(ht.Balance).toBeUndefined()
  })

  it(`registers command variants in routeStatic.handleCommandText when intentCommandTextMap is set`, () => {
    const data = makePageData({
      name: `balance`,
      intentText: `Balance`,
      intentCommandText: `balance`,
      intentCommandTextMap: {default: `balance`, en: `balance`, id: `saldo`}
    })
    const Page = makePage(`BalancePage`, data)
    ;(Page.prototype as any).handleCommandText = async () => {}

    const pages = makePages()
    const bot = new TestGramstax()
    bot.callPageSorts(Page, pages as any, 0)

    const hct = pages.routeStatic.handleCommandText
    expect(hct[`/balance`]).toEqual({name: `balance`, routeName: `handleCommandText`})
    expect(hct[`/saldo`]).toEqual({name: `balance`, routeName: `handleCommandText`})
  })

  it(`falls back to single intent when intentTextMap is not set`, () => {
    const data = makePageData({
      name: `balance`,
      intentText: `Balance`
    })
    const Page = makePage(`BalancePage`, data)
    ;(Page.prototype as any).handleText = async () => {}

    const pages = makePages()
    const bot = new TestGramstax()
    bot.callPageSorts(Page, pages as any, 0)

    const ht = pages.routeStatic.handleText
    expect(ht.Balance).toEqual({name: `balance`, routeName: `handleText`})
    // No language-prefixed keys
    expect(ht[`en:Balance`]).toBeUndefined()
    expect(ht[`id:Balance`]).toBeUndefined()
  })

  it(`registers all variants in routeStaticIntent.handleArgsText when intentTextMap is set`, () => {
    const data = makePageData({
      name: `detail`,
      intentText: `Detail`,
      intentTextMap: {default: `Detail`, en: `Detail`, id: `Detail`}
    })
    const Page = makePage(`DetailPage`, data)
    ;(Page.prototype as any).handleArgsText = async () => {}

    const pages = makePages()
    const bot = new TestGramstax()
    bot.callPageSorts(Page, pages as any, 0)

    const hat = pages.routeStaticIntent.handleArgsText
    expect(hat[`default:Detail`]).toEqual({name: `detail`, routeName: `handleArgsText`})
    expect(hat[`en:Detail`]).toEqual({name: `detail`, routeName: `handleArgsText`})
    expect(hat[`id:Detail`]).toEqual({name: `detail`, routeName: `handleArgsText`})
  })

  it(`skips routes whose handler method does not exist on the page`, () => {
    const data = makePageData({
      name: `balance`,
      intentText: `Balance`,
      intentTextMap: {default: `Balance`}
    })
    const Page = makePage(`BalancePage`, data)
    // NO handleText handler defined

    const pages = makePages()
    const bot = new TestGramstax()
    bot.callPageSorts(Page, pages as any, 0)

    const ht = pages.routeStatic.handleText
    // No keys should be registered since the handler doesn't exist
    expect(Object.keys(ht)).toHaveLength(0)
  })
})

describe(`_pageSorts callback query data`, () => {
  it(`registers callbackQueryData when shortCallbackQueryData is false`, () => {
    const data = makePageData({
      name: `settings`,
      intentCallbackQueryData: `settings`
    })
    const Page = makePage(`SettingsPage`, data)
    ;(Page.prototype as any).handleCallbackQueryData = async () => {}

    const pages = makePages()
    const bot = new TestGramstax()
    bot.callPageSorts(Page, pages as any, 0)

    const hcqd = pages.routeStatic.handleCallbackQueryData
    expect(hcqd.settings).toEqual({name: `settings`, routeName: `handleCallbackQueryData`})
  })
})

describe(`_pageLoads duplicate detection`, () => {
  it(`detects duplicate intentText variants across pages`, () => {
    const data1 = makePageData({
      name: `page1`,
      intentText: `Balance`,
      intentTextMap: {default: `Balance`}
    })
    const data2 = makePageData({
      name: `page2`,
      intentText: `Saldo`,
      intentTextMap: {default: `Saldo`}
    })

    const seen = new Set<string>()
    const check = (variant: string) => {
      if (seen.has(variant)) throw new Error(`Duplicate intentText variant "${variant}"`)
      seen.add(variant)
    }

    expect(() => {
      for (const [, intent] of Object.entries(data1.intentTextMap!)) check(intent)
    }).not.toThrow()

    expect(() => {
      for (const [, intent] of Object.entries(data2.intentTextMap!)) check(intent)
    }).not.toThrow()

    expect(() => {
      check(`Balance`)
    }).toThrow(`Duplicate intentText variant "Balance"`)
  })

  it(`detects duplicate intentCommandText variants across pages`, () => {
    const seen = new Set<string>()
    const check = (variant: string) => {
      if (seen.has(variant)) throw new Error(`Duplicate intentCommandText variant "${variant}"`)
      seen.add(variant)
    }

    check(`balance`)
    check(`start`)

    expect(() => {
      check(`balance`)
    }).toThrow(`Duplicate intentCommandText variant "balance"`)
  })
})
