import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe(`harness-red-16-watcher-relative`, () => {
  let dir = ``
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), `tm16-`))
  })
  afterEach(async () => {
    await rm(dir, {recursive: true, force: true})
  })
  it(`forwards nested relativePath and stops after first hit`, async () => {
    await mkdir(join(dir, `sub`), {recursive: true})
    await writeFile(join(dir, `sub`, `nested.html`), `<g-base><g-message>Nested</g-message></g-base>`)
    const second = await mkdtemp(join(tmpdir(), `tm16b-`))
    try {
      const tm = new TemplateManager({path: [dir, second]})
      expect(tm.hasCompiled(`sub/nested`)).toBe(true)
      await writeFile(join(dir, `sub`, `nested.html`), `<g-base><g-message>Nested2</g-message></g-base>`)
      tm.handleFileChange(join(dir, `sub`, `nested.html`))
      await wait(200)
      // watcher must resolve subdir file (basename-only would look at dir/nested.html and fail)
      expect(tm.getGMessage(`sub/nested`)).toBe(`Nested2`)
      await tm.destroy()
    } finally {
      await rm(second, {recursive: true, force: true})
    }
  })
  it(`guards missing file instead of throwing ENOENT`, async () => {
    const tm = new TemplateManager({path: [dir]})
    expect(() => tm.loadFile(`does-not-exist.html`)).not.toThrow()
    await tm.destroy()
  })
})

describe(`harness-red-17-gbase-regex`, () => {
  it(`matches <g-base id> enclosing line`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `tm17-`))
    try {
      const tm = new TemplateManager({path: [dir]})
      const info = tm.getGBaseAtLine(`<g-base id="kb">\n<kop/>\n</g-base>`, 2)
      expect(info).toEqual({AGBaseId: `kb`, hasId: true})
      await tm.destroy()
    } finally {
      await rm(dir, {recursive: true, force: true})
    }
  })
})

describe(`harness-red-18-fallback`, () => {
  let dir = ``
  let tm: TemplateManager
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), `tm18-`))
    await writeFile(join(dir, `fb.html`), `<g-base><g-message>Default Msg</g-message><g-keyboard>Def Btn</g-keyboard><g-description>Def Desc</g-description><g-media type="photo" src="d.jpg">Def Cap</g-media></g-base>`)
    tm = new TemplateManager({path: [dir]})
  })
  afterEach(async () => {
    await tm.destroy()
    await rm(dir, {recursive: true, force: true})
  })
  it(`falls back base->default for message`, () => {
    expect(tm.getGMessage(`fb`, `missing-base`, `default`)).toBe(`Default Msg`)
  })
  it(`falls back base->default for keyboard`, () => {
    expect(tm.getGKeyboard(`fb`, `missing-base`, `default`)).toEqual([`Def Btn`])
  })
  it(`falls back base->default for description`, () => {
    expect(tm.getGDescription(`fb`, `missing-base`, `default`, `default`)).toBe(`Def Desc`)
  })
  it(`preserves empty miss contract`, () => {
    expect(tm.getGMessage(`nope`, `default`, `default`)).toBe(``)
    expect(tm.getGKeyboard(`nope`, `default`, `default`)).toEqual([])
  })
})

describe(`harness-red-19-queue-split`, () => {
  it(`exposes closeWatchers and clearCache separately`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `tm19-`))
    try {
      const tm = new TemplateManager({path: [dir]})
      expect(typeof (tm as unknown as {closeWatchers: unknown}).closeWatchers).toBe(`function`)
      expect(typeof (tm as unknown as {clearCache: unknown}).clearCache).toBe(`function`)
      await tm.destroy()
    } finally {
      await rm(dir, {recursive: true, force: true})
    }
  })
  it(`forwards reload errors to handleWatchError`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `tm19e-`))
    try {
      const tm = new TemplateManager({path: [dir]})
      let seen: unknown = null
      tm.handleWatchError = (e: unknown) => {
        seen = e
      }
      ;(tm as unknown as {loadFile: (f: string) => void}).loadFile = () => {
        throw new Error(`boom`)
      }
      tm.handleFileChange(join(dir, `x.html`))
      await wait(200)
      expect(seen !== null).toBe(true)
      await tm.destroy()
    } finally {
      await rm(dir, {recursive: true, force: true})
    }
  })
})

describe(`harness-red-A1-reset`, () => {
  it(`adds reset() while clearCalls stays calls-only`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `e2ea1-`))
    const tm = new TemplateManager({path: [dir]})
    const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false})
    const e2e = bot.e2e!
    expect(typeof e2e.reset).toBe(`function`)
    await e2e.sendText(`hi`)
    const firstId = (e2e as unknown as {_nextMessageId: number})._nextMessageId
    e2e.clearCalls()
    expect(e2e.calls.length).toBe(0)
    // clearCalls must NOT reset counters
    expect((e2e as unknown as {_nextMessageId: number})._nextMessageId).toBe(firstId)
    e2e.reset()
    expect(e2e.calls.length).toBe(0)
    expect((e2e as unknown as {_nextMessageId: number})._nextMessageId).toBe(1)
    await bot.stop()
    await tm.destroy()
    await rm(dir, {recursive: true, force: true})
  })
})

describe(`harness-red-A2-internal-filter`, () => {
  it(`does not record getMe/getWebhookInfo/setWebhook/getMyCommands/getUpdates`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `e2ea2-`))
    const tm = new TemplateManager({path: [dir]})
    const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false})
    const e2e = bot.e2e!
    await (bot.bot.api as any).getMe()
    await (bot.bot.api as any).getWebhookInfo()
    expect(e2e.calls.filter((c) => [`getMe`, `getWebhookInfo`, `setWebhook`, `getMyCommands`, `getUpdates`].includes(c.method)).length).toBe(0)
    await bot.stop()
    await tm.destroy()
    await rm(dir, {recursive: true, force: true})
  })
})

describe(`harness-red-A3-parity`, () => {
  it(`send* resolves message shape and answer/edit/delete resolve true`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `e2ea3-`))
    const tm = new TemplateManager({path: [dir]})
    const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false})
    const sent = (await (bot.bot.api as any).sendMessage(7, `hi`)) as unknown as {message_id: number; date: number; chat: unknown}
    expect(typeof sent.message_id).toBe(`number`)
    expect(typeof sent.date).toBe(`number`)
    expect((sent.chat as {id: number}).id).toBe(7)
    expect(await (bot.bot.api as any).answerCallbackQuery(`q`, {text: `ok`})).toBe(true)
    expect(await (bot.bot.api as any).editMessageText(7, 1, `x`)).toBe(true)
    expect(await (bot.bot.api as any).deleteMessage(7, 1)).toBe(true)
    await bot.stop()
    await tm.destroy()
    await rm(dir, {recursive: true, force: true})
  })
})

describe(`harness-red-A4-order-lock`, () => {
  it(`gmsg/gkb forward order vs templateManager`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `e2ea4-`))
    await writeFile(join(dir, `ord.html`), `<g-base><g-message lang="en">Hi {{name}}</g-message><g-keyboard lang="en" type="inline">B1</g-keyboard></g-base>`)
    const tm = new TemplateManager({path: [dir]})
    const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false})
    const e2e = bot.e2e!
    // lock: gmsg(page, base, data, lang) === getGMessage(page, base, lang, data)
    expect(e2e.gmsg(`ord`, `default`, {name: `Z`}, `en`)).toBe(tm.getGMessage(`ord`, `default`, `en`, {name: `Z`}))
    // lock: gkb(page, base, type, data, lang) === getGKeyboard(page, base, lang, type, data)
    expect(e2e.gkb(`ord`, `default`, `inline`, {name: `Z`}, `en`)).toEqual(tm.getGKeyboard(`ord`, `default`, `en`, `inline`, {name: `Z`}))
    await bot.stop()
    await tm.destroy()
    await rm(dir, {recursive: true, force: true})
  })
})

describe(`harness-red-A5-extractText`, () => {
  it(`html ?? markdown ?? text ?? caption`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `e2ea5-`))
    const tm = new TemplateManager({path: [dir]})
    const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false})
    const e2e = bot.e2e!
    expect(e2e.extractText({method: `sendMessage`, body: {rich_message: {markdown: `md`}}, timestamp: 0})).toBe(`md`)
    expect(e2e.extractText({method: `sendMessage`, body: {caption: `cap`}, timestamp: 0})).toBe(`cap`)
    expect(e2e.extractText({method: `sendMessage`, body: {rich_message: {html: `h`, markdown: `md`}, text: `t`, caption: `c`}, timestamp: 0})).toBe(`h`)
    await bot.stop()
    await tm.destroy()
    await rm(dir, {recursive: true, force: true})
  })
})

describe(`harness-red-A6-buttons`, () => {
  it(`reads inline + bottom keyboards`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `e2ea6-`))
    const tm = new TemplateManager({path: [dir]})
    const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false})
    const e2e = bot.e2e!
    expect(e2e.extractButtonLabels({method: `sendMessage`, body: {reply_markup: {keyboard: [[{text: `A`}], [{text: `B`}]]}}, timestamp: 0})).toEqual([`A`, `B`])
    expect(e2e.extractButtonLabels({method: `sendMessage`, body: {reply_markup: {inline_keyboard: [[{text: `I`}]]}}, timestamp: 0})).toEqual([`I`])
    await bot.stop()
    await tm.destroy()
    await rm(dir, {recursive: true, force: true})
  })
})

describe(`harness-red-A7-settle`, () => {
  it(`handleUpdate honors settleMs`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `e2ea7-`))
    const tm = new TemplateManager({path: [dir]})
    const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false})
    const e2e = bot.e2e!
    const start = Date.now()
    await (e2e as any).handleUpdate({update_id: 999, message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, from: {id: 1, is_bot: false, first_name: `T`}, text: `hi`}}, 60)
    expect(Date.now() - start >= 40).toBe(true)
    await bot.stop()
    await tm.destroy()
    await rm(dir, {recursive: true, force: true})
  })
})

describe(`harness-red-A10-stream-edits`, () => {
  it(`streamCalls includes stream edit methods`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `e2ea10-`))
    const tm = new TemplateManager({path: [dir]})
    const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false})
    const e2e = bot.e2e!
    e2e.calls.push({method: `editEphemeralMessageText`, body: {}, timestamp: 0})
    e2e.calls.push({method: `editMessageText`, body: {}, timestamp: 0})
    expect(e2e.streamCalls().some((c) => c.method === `editEphemeralMessageText`)).toBe(true)
    expect(e2e.streamCalls().some((c) => c.method === `editMessageText`)).toBe(true)
    await bot.stop()
    await tm.destroy()
    await rm(dir, {recursive: true, force: true})
  })
})

describe(`harness-red-A11-absent`, () => {
  it(`explicit undefined passes through defaults`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `e2ea11-`))
    const tm = new TemplateManager({path: [dir]})
    const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: tm, log: false})
    const e2e = bot.e2e!
    const u = (e2e as any)._defaultUser({id: undefined})
    expect(`id` in u).toBe(true)
    expect(u.id).toBe(undefined)
    const n = (e2e as any)._nextIds({message_id: undefined})
    expect(n.messageId).toBe(undefined)
    await bot.stop()
    await tm.destroy()
    await rm(dir, {recursive: true, force: true})
  })
})

describe(`harness-red-views-cleanup`, () => {
  it(`removes stray views dir`, async () => {
    if (existsSync(join(import.meta.dir, `views`))) {
      await rm(join(import.meta.dir, `views`), {recursive: true, force: true})
    }
    expect(existsSync(join(import.meta.dir, `views`))).toBe(false)
  })
})
