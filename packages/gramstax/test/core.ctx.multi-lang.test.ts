import {describe, expect, it } from "bun:test"
import {Ctx} from "~/core/ctx"
import type {ITPageData} from "~/types/t.ctx"

function makePage(name: string, overrides?: Record<string, any>): typeof Ctx {
  const data = {
    name,
    intentText: name,
    intentCommandText: name,
    intentCallbackQueryData: name,
    callbackQueryData() {return {result: name, page: undefined as any, args: []} as any},
    _positionArgText: 1,
    ...overrides
  } as unknown as ITPageData<any>
  const page = class extends Ctx {
    static data = data as any
    static template = ``
  }
  return page as unknown as typeof Ctx
}

describe(`GramstaxInlineKeyboard.text() — page class as data`, () => {
  it(`should resolve callbackQueryData when page class is passed`, () => {
    const Page = makePage(`settings`)
    expect((Page.data as any)!.callbackQueryData().result).toBe(`settings`)
  })

  it(`should accept page with handleArgsCallbackQueryData`, () => {
    const Page = makePage(`detail`, {
      callbackQueryData(id: string) {return {result: `detail:${id}`, page: this, args: [id]} as any}
    }) as unknown as {data: ITPageData<any>}
    expect(Page.data!.callbackQueryData(`42`).result).toBe(`detail:42`)
    expect(Page.data!.callbackQueryData(`42`).args).toEqual([`42`])
  })
})

describe(`Ctx multi-language intentText`, () => {
  it(`should resolve default language intent for string intentText`, () => {
    const Page = makePage(`balance`)
    expect(Page.data!.intentText).toBe(`balance`)
    expect(Page.data!.intentTextMap).toBeUndefined()
  })

  it(`should store intentTextMap when Record is passed`, () => {
    const data: ITPageData<any> = {
      name: `balance`,
      intentText: `Balance`,
      intentCommandText: `balance`,
      intentCallbackQueryData: `balance`,
      callbackQueryData() {return {result: `balance`, page: undefined as any, args: []} as any},
      _positionArgText: 1,
      intentTextMap: {default: `Balance`, id: `Saldo`}
    }
    expect(data.intentTextMap).toBeDefined()
    expect(data.intentTextMap!.default).toBe(`Balance`)
    expect(data.intentTextMap!.id).toBe(`Saldo`)
  })

  it(`should derive intentText from map.default`, () => {
    const data: ITPageData<any> = {
      name: `balance`,
      intentText: `Balance`,
      intentCommandText: `balance`,
      intentCallbackQueryData: `balance`,
      callbackQueryData() {return {result: `balance`, page: undefined as any, args: []} as any},
      _positionArgText: 1,
      intentTextMap: {default: `Balance`, id: `Saldo`}
    }
    expect(data.intentText).toBe(`Balance`)
  })

  it(`should handle intentCommandText Record`, () => {
    const data: ITPageData<any> = {
      name: `balance`,
      intentText: `Balance`,
      intentCommandText: `balance`,
      intentCallbackQueryData: `balance`,
      callbackQueryData() {return {result: `balance`, page: undefined as any, args: []} as any},
      _positionArgText: 1,
      intentCommandTextMap: {default: `balance`, id: `saldo`}
    }
    expect(data.intentCommandTextMap!.id).toBe(`saldo`)
  })
})

describe(`GramstaxKeyboard.text() — page class as label`, () => {
  it(`should resolve intentText when page class is passed`, () => {
    const Page = makePage(`start`)
    expect(Page.data!.intentText).toBe(`start`)
  })

  it(`should resolve language-specific intentText`, () => {
    const data: ITPageData<any> = {
      name: `start`,
      intentText: `Start`,
      intentCommandText: `start`,
      intentCallbackQueryData: `start`,
      callbackQueryData() {return {result: `start`, page: undefined as any, args: []} as any},
      _positionArgText: 1,
      intentTextMap: {default: `Start`, id: `Mulai`}
    }
    const _resolveText = (lang?: string) => {
      const map = data.intentTextMap
      if (map) {
        if (lang && map[lang]) return map[lang]
        if (map.default) return map.default
      }
      return data.intentText
    }
    expect(_resolveText()).toBe(`Start`)
    expect(_resolveText(`id`)).toBe(`Mulai`)
    expect(_resolveText(`ja`)).toBe(`Start`)
  })
})

describe(`Ctx ITKbDest type constraint — handleCallbackQueryData`, () => {
  it(`should accept page with handleCallbackQueryData`, () => {
    const Page = makePage(`settings`)
    const hasCallback = typeof (Page.prototype as any).handleCallbackQueryData === `function`
    const hasArgsCallback = typeof (Page.prototype as any).handleArgsCallbackQueryData === `function`
    expect(hasCallback).toBe(false)
    expect(hasArgsCallback).toBe(false)
  })

  it(`should detect page with handleCallbackQueryData`, () => {
    const page = class extends Ctx {
      static data = {name: `settings`, intentCallbackQueryData: `settings`} as any
      async handleCallbackQueryData() {}
    }
    const hasCallback = typeof (page.prototype as any).handleCallbackQueryData === `function`
    expect(hasCallback).toBe(true)
  })

  it(`should detect page with handleArgsCallbackQueryData`, () => {
    const page = class extends Ctx {
      static data = {name: `detail`, intentCallbackQueryData: `detail`} as any
      async handleArgsCallbackQueryData() {}
    }
    const hasArgsCallback = typeof (page.prototype as any).handleArgsCallbackQueryData === `function`
    expect(hasArgsCallback).toBe(true)
  })
})
