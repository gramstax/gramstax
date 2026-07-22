import {describe, it, expect, beforeEach, afterEach, spyOn} from "bun:test"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"
import {mkdir, rm} from "node:fs/promises"
import {existsSync} from "node:fs"
import {join} from "node:path"

const TEST_DIR = join(import.meta.dir, `__tmp_raw`)

describe(`Gramstax._buildEmptyPages (refactor)`, () => {
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

  it(`returns a typed skeleton with no routes`, () => {
    const tm = new TemplateManager({path: [TEST_DIR]})
    const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false})
    const pages = (bot as any)._buildEmptyPages()
    expect(pages.all).toEqual({})
    expect(pages.routeDynamic).toEqual([])
    expect(Object.keys(pages.routeStatic)).toContain(`handleCommandText`)
    expect(Object.keys(pages.routeStatic.handleCommandText)).toEqual([])
    expect(Object.keys(pages.routeStaticIntent.handleArgsText)).toEqual([])
    expect(pages.routeDynamicSpesific.text).toEqual([])
    expect(pages.routeDynamicSpesific.photo).toEqual([])
    expect(pages.routeDynamicSpesific.contact).toEqual([])
    expect(pages.lenListRouteStatic).toBeGreaterThan(0)
    expect(pages.lenListRouteStaticSession).toBeGreaterThan(0)
  })
})

describe(`Gramstax deploy:"raw"`, () => {
  it(`constructs offline with deployType "raw" and no templateManager`, () => {
    const bot = new Gramstax({token: `123:abc`, deploy: `raw`, log: false})
    expect(bot.deployType).toBe(`raw`)
    expect(bot.templateManager).toBeUndefined()
    expect(bot.pages.all).toEqual({})
    expect(bot.bot).toBeDefined()
    expect(typeof bot.bot.use).toBe(`function`)
    expect(typeof bot.bot.on).toBe(`function`)
    expect(typeof bot.bot.command).toBe(`function`)
    // grammY exposes isRunning as a property; casting to any returns a getter
    expect((bot.bot as any).isRunning).toBeDefined()
  })

  it(`registers ZERO Gramstax routing listeners on the raw bot`, () => {
    const bot = new Gramstax({token: `123:abc`, deploy: `raw`, log: false})
    const onSpy = spyOn(bot.bot, `on`).mockImplementation(() => bot.bot as any)
    expect(onSpy).not.toHaveBeenCalled()
    onSpy.mockRestore()
  })

  it(`lets the user attach raw grammY handlers without throwing`, () => {
    const bot = new Gramstax({token: `123:abc`, deploy: `raw`, log: false})
    expect(() => {
      bot.bot.command(`start`, (ctx: any) => ctx.reply(`hi`))
      bot.bot.on(`message`, () => {})
    }).not.toThrow()
  })

  it(`invokes hookBeforeStart in raw mode but not hookAfterStart`, () => {
    let hookBeforeCalled = false
    let hookAfterCalled = false
    class RawBot extends Gramstax {
      async hookBeforeStart() {
        hookBeforeCalled = true
      }
      async hookAfterStart() {
        hookAfterCalled = true
      }
    }
    new RawBot({token: `123:abc`, deploy: `raw`, log: false})
    expect(hookBeforeCalled).toBe(true)
    expect(hookAfterCalled).toBe(false)
  })
})

describe(`Gramstax deploy:"raw" exception removal`, () => {
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

  it(`throws when templateManager: {} as any is used in a non-raw mode`, () => {
    expect(() => new Gramstax({token: `123:abc`, deploy: `polling`, templateManager: {} as any, log: false})).toThrow(
      /deploy: "raw"/
    )
  })

  it(`still accepts a real TemplateManager in non-raw mode`, () => {
    const tm = new TemplateManager({path: [TEST_DIR]})
    // Use deploy:test to avoid async 401 from fake-token bot.start()
    expect(() => new Gramstax({token: `123:abc`, deploy: `test`, templateManager: tm, log: false})).not.toThrow()
  })
})
