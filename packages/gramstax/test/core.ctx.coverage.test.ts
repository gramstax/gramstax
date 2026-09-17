import {afterEach, describe, expect, it, mock} from "bun:test"
import {mkdir, rm, writeFile} from "node:fs/promises"

import {join} from "node:path"
import {InlineKeyboard, InputFile} from "grammy"
import {Ctx} from "~/core/ctx"
import {TemplateManager} from "~/template/manager"

import type {ITCtxParams} from "~/types/t.ctx"

const TEST_DIR = join(import.meta.dir, `ctx_coverage_views`)

afterEach(async () => {
  await rm(TEST_DIR, {recursive: true, force: true})
})

class CovPage extends Ctx {
  static data = Ctx.buildData({name: `cov`})
}

class CbPage extends Ctx {
  static data = {
    name: `cbpage`,
    intentText: `CB`,
    intentCommandText: `cbpage`,
    intentCallbackQueryData: `cbpage`,
    intentTextMap: {en: `CB-en`, default: `CB`},
    callbackQueryData: () => ({result: `cbdata`, page: CbPage, args: [] as string[]})
  } as never
  async handleCallbackQueryData() {}
}

class PlainPage extends Ctx {
  static data = {name: `plain`, intentText: `Plain`, intentCommandText: `plain`, intentCallbackQueryData: `plain`} as never
  async handleCallbackQueryData() {}
}

const makeApi = () => ({
  config: {use: () => {}},
  sendMessage: mock(async () => ({message_id: 1} as never)),
  sendMediaGroup: mock(async () => [{message_id: 1}] as never),
  editMessageMedia: mock(async () => ({message_id: 1} as never)),
  editMessageText: mock(async () => ({message_id: 1} as never)),
  deleteMessage: mock(async () => true as never),
  sendPhoto: mock(async () => ({message_id: 1} as never)),
  sendVideo: mock(async () => ({message_id: 1} as never)),
  sendAudio: mock(async () => ({message_id: 1} as never)),
  sendDocument: mock(async () => ({message_id: 1} as never)),
  sendAnimation: mock(async () => ({message_id: 1} as never)),
  sendVoice: mock(async () => ({message_id: 1} as never)),
  sendVideoNote: mock(async () => ({message_id: 1} as never)),
  sendSticker: mock(async () => ({message_id: 1} as never)),
  sendLocation: mock(async () => ({message_id: 1} as never)),
  sendContact: mock(async () => ({message_id: 1} as never)),
  sendRichMessage: mock(async () => ({message_id: 1} as never))
})

const makeCtx = (Page: typeof Ctx, update: Record<string, unknown>, tm: unknown, api: Record<string, unknown>, lang = `en`) => {
  const from = {id: 1, is_bot: false, first_name: `Alya`, last_name: `Putri`, language_code: lang}
  const withFrom = JSON.parse(JSON.stringify(update)) as Record<string, unknown>
  const msg = (withFrom.message ?? withFrom.edited_message ?? withFrom.channel_post) as Record<string, unknown> | undefined
  if (msg) {
    msg.from = from
    if (msg.chat === undefined) msg.chat = {id: 1, type: `private`}
  }
  const cb = withFrom.callback_query as Record<string, unknown> | undefined
  if (cb) {
    cb.from = from
    const cbMsg = cb.message as Record<string, unknown> | undefined
    if (cbMsg) {
      cbMsg.from = from
      if (cbMsg.chat === undefined) cbMsg.chat = {id: 1, type: `private`}
    }
  }
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update: withFrom} as unknown as ITCtxParams[`ct`]
  return new Page({
    ct,
    cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ITCtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

describe(`ctx-coverage-getters`, () => {
  it(`reads grammy field getters`, () => {
    const tm = {getGMessage: () => ``} as never
    const ctx = makeCtx(CovPage, {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}, tm, makeApi())
    for (const key of [`managedBot`, `messageReaction`, `poll`, `pollAnswer`, `preCheckoutQuery`, `purchasedPaidMedia`, `removedChatBoost`, `senderChat`]) {
      expect((ctx as unknown as Record<string, unknown>)[key]).toBeUndefined()
    }
  })

  it(`reads convenience getters from message, caption, and callback updates`, () => {
    const tm = {getGMessage: () => ``} as never
    const ctx = makeCtx(
      CovPage,
      {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `/cmd a b c`, caption: `cap x y`}},
      tm,
      makeApi()
    )
    expect(ctx.fromFullName).toBe(`Alya Putri`)
    expect(ctx.msgTextArgs).toEqual([`a`, `b`, `c`])
    expect(ctx.msgTextArg).toBe(`a`)
    expect(ctx.msgTextCommandArgs).toEqual([`a`, `b`, `c`])
    expect(ctx.msgTextCommandArg).toBe(`a`)
    expect(ctx.msgCaptionArgs).toEqual([`x`, `y`])
    expect(ctx.msgCaptionArg).toBe(`x`)
    expect(ctx.msgCommandCaptionArgs).toEqual([`x`, `y`])
    expect(ctx.msgCommandCaptionArg).toBe(`x`)
    const cbx = makeCtx(CovPage, {callback_query: {id: `q`, data: `act:1:2`, chat_instance: `ci`, message: {message_id: 2, date: 2, text: `m`}}}, tm, makeApi())
    expect(cbx.callbackQueryDataArgs).toEqual([`1`, `2`])
    expect(cbx.callbackQueryDataArg).toBe(`1`)
  })

  it(`uses args helpers directly`, () => {
    const tm = {getGMessage: () => ``} as never
    const ctx = makeCtx(CovPage, {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}, tm, makeApi())
    expect(ctx.addArgs(`base`, `colon`, [`a`, undefined, ``, `b`])).toBe(`base:a:b`)
    expect(ctx.getArgs(`a:b:c`, `colon`)).toEqual([`b`, `c`])
    expect(ctx.getArgs(``, `colon`)).toEqual([])
    expect(ctx.getIntent(`start:123:456`, `colon`, 1)).toBe(`start`)
    expect(ctx.getIntent(`start:123:456`, `colon`, 2)).toBe(`start:123`)
    expect(ctx.getIntent(``, `colon`)).toBe(``)
  })
})

describe(`ctx-coverage-builddata`, () => {
  it(`builds data with callback fn, maps, and keyboard cols layouts`, () => {
    const withCb = Ctx.buildData({name: `w`, callbackQueryData: (...args: string[]) => args})
    expect((withCb.callbackQueryData as (...a: string[]) => {result: string})(`a`, `b`).result).toBe(`w:a:b`)
    const plain = Ctx.buildData({name: `y`})
    expect((plain.callbackQueryData as () => {result: string})().result).toBe(`y`)
    const mapped = Ctx.buildData({name: `m`, intentText: {en: `Hi`, default: `Hey`}, intentCommandText: {en: `go`}})
    expect(mapped.intentText).toBe(`Hey`)
    expect(mapped.intentTextMap).toBeDefined()
    expect(mapped.intentCommandTextMap).toBeDefined()
    const tm = {getGMessage: () => ``} as never
    const ctx = makeCtx(CovPage, {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}, tm, makeApi())
    const kb = new InlineKeyboard()
    expect(ctx.keyboardCols(kb, [`a`, `b`, `c`, `d`], `2`, (e, i) => kb.text(e, `${i}`))).toBe(kb)
    expect(ctx.keyboardCols(new InlineKeyboard(), [`a`, `b`, `c`], `2-1`, (e, i) => kb.text(e, `${i}`))).toBeDefined()
  })
})

const pageFor = (name: string) => {
  class P extends Ctx {
    static data = Ctx.buildData({name})
  }
  return P
}

describe(`ctx-coverage-keyboards`, () => {
  it(`builds template and manual keyboards with page labels`, async () => {
    const dir = join(TEST_DIR, `kb`)
    await mkdir(dir, {recursive: true})
    await writeFile(
      join(dir, `cov.html`),
      `<g-base><g-message>Hi</g-message><g-keyboard lang="en" type="inline">B1,B2,B3</g-keyboard><g-keyboard lang="en" type="bottom">C1,C2</g-keyboard><g-keyboard type="bottom">D1</g-keyboard></g-base>`
    )
    const tm = new TemplateManager({path: [dir]})
    try {
      const api = makeApi()
      const update = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}
      const ctxEn = makeCtx(CovPage, update, tm, api, `en`)
      const cbData = (CbPage.data as unknown as {callbackQueryData: () => {result: string; page: typeof CbPage; args: string[]}}).callbackQueryData()
      const ikb = ctxEn.inlineKeyboardT([CbPage, `plain`, cbData], `1`)
      expect(JSON.stringify(ikb)).toContain(`cbdata`)
      const bkbEn = ctxEn.bottomKeyboardT([CbPage, `plain`], `1`)
      expect(JSON.stringify(bkbEn)).toContain(`CB-en`)
      const ctxFr = makeCtx(CovPage, update, tm, api, `fr`)
      expect(JSON.stringify(ctxFr.bottomKeyboardT([CbPage], `1`))).toContain(`CB`)
      expect(JSON.stringify(ctxFr.bottomKeyboardT([PlainPage], `1`))).toContain(`Plain`)
      const manual = ctxEn.bottomKeyboard((k) => k.text(CbPage))
      expect(JSON.stringify(manual)).toContain(`CB`)
      const objLabel = ctxEn.inlineKeyboard((k) => k.text({text: CbPage} as never, `x`))
      expect(JSON.stringify(objLabel)).toContain(`CB`)
      const pageData = ctxEn.inlineKeyboard((k) => k.text(`L`, CbPage))
      expect(JSON.stringify(pageData)).toContain(`cbdata`)
      const cached1 = ctxEn.inlineKeyboard((k) => k, {cache: true})
      const cached2 = ctxEn.inlineKeyboard((k) => k, {cache: true})
      expect(cached1).toBe(cached2)
      expect(ctxEn.bottomKeyboardT(`2`)).toBeDefined()
    } finally {
      await tm.destroy()
    }
  })
})

describe(`ctx-coverage-download`, () => {
  it(`downloads via getFile and validates paths`, async () => {
    const tm = {getGMessage: () => ``} as never
    const api = makeApi()
    const ctx = makeCtx(CovPage, {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}, tm, api)
    const download = mock(async (p?: string) => `dl:${p ?? `def`}`)
    ;(ctx as unknown as {getFile: unknown}).getFile = mock(async () => ({download}))
    expect(await ctx.download()).toBe(`dl:def`)
    expect(await ctx.download(`a/b.txt`)).toBe(`dl:a/b.txt`)
    await expect(ctx.download(`a\0b`)).rejects.toThrow(/null bytes/)
    await expect(ctx.download(`../x`)).rejects.toThrow(/\.\./)
  })
})

describe(`ctx-coverage-media`, () => {
  it(`renders media groups, singles, and auto variants`, async () => {
    const dir = join(TEST_DIR, `media`)
    await mkdir(dir, {recursive: true})
    await writeFile(join(dir, `grp.html`), `<g-base><g-media-group><g-media type="photo" src="a.jpg">Cap</g-media><g-media type="photo" src="b.jpg"></g-media></g-media-group></g-base>`)
    await writeFile(join(dir, `pipe.html`), `<g-base><g-media type="photo" src="one.jpg|two.jpg">Album</g-media></g-base>`)
    await writeFile(join(dir, `single.html`), `<g-base><g-media type="photo" src="s.jpg">Hi</g-media></g-base>`)
    await writeFile(join(dir, `vpipe.html`), `<g-base><g-media type="video" src="v1.mp4|v2.mp4"></g-media></g-base>`)
    await writeFile(join(dir, `apipe.html`), `<g-base><g-media type="audio" src="a1.mp3|a2.mp3"></g-media></g-base>`)
    await writeFile(join(dir, `dpipe.html`), `<g-base><g-media type="document" src="d1.pdf|d2.pdf"></g-media></g-base>`)
    await writeFile(join(dir, `vsingle.html`), `<g-base><g-media type="video" src="v.mp4"></g-media></g-base>`)
    await writeFile(join(dir, `asingle.html`), `<g-base><g-media type="audio" src="a.mp3"></g-media></g-base>`)
    await writeFile(join(dir, `dsingle.html`), `<g-base><g-media type="document" src="d.pdf"></g-media></g-base>`)
    await writeFile(join(dir, `anim.html`), `<g-base><g-media type="animation" src="a.gif"></g-media></g-base>`)
    await writeFile(join(dir, `voice.html`), `<g-base><g-media type="voice" src="v.ogg"></g-media></g-base>`)
    await writeFile(join(dir, `vnote.html`), `<g-base><g-media type="video_note" src="n.mp4"></g-media></g-base>`)
    await writeFile(join(dir, `sticker.html`), `<g-base><g-media type="sticker" src="s.webp"></g-media></g-base>`)
    await writeFile(join(dir, `loc.html`), `<g-base><g-media type="location" latitude="1.5" longitude="2.5"></g-media></g-base>`)
    await writeFile(join(dir, `contact.html`), `<g-base><g-media type="contact" phone="+100" first_name="A" vcard="vc"></g-media></g-base>`)
    await writeFile(join(dir, `video.html`), `<g-base><g-media type="video" src="v.mp4"></g-media></g-base>`)
    await writeFile(join(dir, `audio.html`), `<g-base><g-media type="audio" src="a.mp3"></g-media></g-base>`)
    await writeFile(join(dir, `doc.html`), `<g-base><g-media type="document" src="d.pdf"></g-media></g-base>`)
    const tm = new TemplateManager({path: [dir]})
    try {
      const api = makeApi()
      const msg = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}
      const grp = makeCtx(pageFor(`grp`), msg, tm, api)
      await grp.renderMediaGroup()
      expect(api.sendMediaGroup).toHaveBeenCalled()
      await expect(grp.renderMediaGroup(`video`)).rejects.toThrow(/no items of type/)
      const single = makeCtx(pageFor(`single`), msg, tm, api)
      await expect(single.renderMediaGroup()).rejects.toThrow(/type is required/)
      const pipe = makeCtx(pageFor(`pipe`), msg, tm, api)
      await pipe.renderMediaGroup(`photo`)
      await pipe.renderPhotoGroup()
      const vp = makeCtx(pageFor(`vpipe`), msg, tm, api)
      await vp.renderVideoGroup()
      const ap = makeCtx(pageFor(`apipe`), msg, tm, api)
      await ap.renderAudioGroup()
      const dp = makeCtx(pageFor(`dpipe`), msg, tm, api)
      await dp.renderDocumentGroup()
      await makeCtx(pageFor(`single`), msg, tm, api).renderPhoto()
      await makeCtx(pageFor(`vsingle`), msg, tm, api).renderVideo()
      await makeCtx(pageFor(`asingle`), msg, tm, api).renderAudio()
      await makeCtx(pageFor(`dsingle`), msg, tm, api).renderDocument()
      await makeCtx(pageFor(`anim`), msg, tm, api).renderAnimation()
      await makeCtx(pageFor(`voice`), msg, tm, api).renderVoice()
      await makeCtx(pageFor(`vnote`), msg, tm, api).renderVideoNote()
      await makeCtx(pageFor(`sticker`), msg, tm, api).renderSticker()
      await makeCtx(pageFor(`loc`), msg, tm, api).renderLocation()
      await makeCtx(pageFor(`contact`), msg, tm, api).renderContact()
      await makeCtx(pageFor(`video`), msg, tm, api).renderVideo()
      await makeCtx(pageFor(`audio`), msg, tm, api).renderAudio()
      await makeCtx(pageFor(`doc`), msg, tm, api).renderDocument()
      await pipe.renderAutoMedia(`photo`)
      await pipe.renderAutoMediaGroup(`photo`)
      const cb = makeCtx(pageFor(`pipe`), {callback_query: {id: `q`, data: `x`, chat_instance: `ci`, message: {message_id: 2, date: 2, text: `m`}}}, tm, api)
      await cb.renderAutoMedia(`photo`)
      await cb.renderAutoMediaGroup(`photo`)
    } finally {
      await tm.destroy()
    }
  })
})

describe(`ctx-coverage-edit`, () => {
  it(`edits media across types and fallbacks`, async () => {
    const dir = join(TEST_DIR, `edit`)
    await mkdir(dir, {recursive: true})
    await writeFile(join(dir, `single.html`), `<g-base><g-media type="photo" src="s.jpg">Hi</g-media></g-base>`)
    await writeFile(join(dir, `vsingle.html`), `<g-base><g-media type="video" src="v.mp4"></g-media></g-base>`)
    await writeFile(join(dir, `asingle.html`), `<g-base><g-media type="audio" src="a.mp3"></g-media></g-base>`)
    await writeFile(join(dir, `dsingle.html`), `<g-base><g-media type="document" src="d.pdf"></g-media></g-base>`)
    await writeFile(join(dir, `voice.html`), `<g-base><g-media type="voice" src="v.ogg"></g-media></g-base>`)
    await writeFile(join(dir, `vnote.html`), `<g-base><g-media type="video_note" src="n.mp4"></g-media></g-base>`)
    await writeFile(join(dir, `sticker.html`), `<g-base><g-media type="sticker" src="s.webp"></g-media></g-base>`)
    await writeFile(join(dir, `loc.html`), `<g-base><g-media type="location" latitude="1.5" longitude="2.5"></g-media></g-base>`)
    await writeFile(join(dir, `contact.html`), `<g-base><g-media type="contact" phone="+100" first_name="A" vcard="vc"></g-media></g-base>`)
    await writeFile(join(dir, `anim.html`), `<g-base><g-media type="animation" src="a.gif"></g-media></g-base>`)
    await writeFile(join(dir, `pipe.html`), `<g-base><g-media type="photo" src="one.jpg|two.jpg">Album</g-media></g-base>`)
    await writeFile(join(dir, `grp.html`), `<g-base><g-media-group><g-media type="photo" src="a.jpg">Cap</g-media><g-media type="photo" src="b.jpg"></g-media></g-media-group></g-base>`)
    const tm = new TemplateManager({path: [dir]})
    try {
      const msg = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}
      const api = makeApi()
      await makeCtx(pageFor(`single`), msg, tm, api).renderEditMedia(`photo`)
      expect(api.editMessageMedia).toHaveBeenCalled()
      await makeCtx(pageFor(`voice`), msg, tm, api).renderEditMedia(`voice`)
      await makeCtx(pageFor(`vnote`), msg, tm, api).renderEditMedia(`video_note`)
      await makeCtx(pageFor(`sticker`), msg, tm, api).renderEditMedia(`sticker`)
      await makeCtx(pageFor(`loc`), msg, tm, api).renderEditMedia(`location`)
      await makeCtx(pageFor(`contact`), msg, tm, api).renderEditMedia(`contact`)
      expect(api.sendVoice).toHaveBeenCalled()
      expect(api.sendVideoNote).toHaveBeenCalled()
      expect(api.sendSticker).toHaveBeenCalled()
      expect(api.sendLocation).toHaveBeenCalled()
      expect(api.sendContact).toHaveBeenCalled()
      await makeCtx(pageFor(`pipe`), msg, tm, api).renderEditMedia(`photo`)
      await makeCtx(pageFor(`single`), msg, tm, api).renderEditPhoto()
      await makeCtx(pageFor(`vsingle`), msg, tm, api).renderEditVideo()
      await makeCtx(pageFor(`asingle`), msg, tm, api).renderEditAudio()
      await makeCtx(pageFor(`dsingle`), msg, tm, api).renderEditDocument()
      await expect(makeCtx(pageFor(`pipe`), msg, tm, api).renderEditMediaGroup()).rejects.toThrow(/type is required/)
      await makeCtx(pageFor(`grp`), msg, tm, api).renderEditMediaGroup()
      await makeCtx(pageFor(`pipe`), msg, tm, api).renderEditPhotoGroup()
      await makeCtx(pageFor(`pipe`), msg, tm, api).renderEditVideoGroup()
      await makeCtx(pageFor(`pipe`), msg, tm, api).renderEditAudioGroup()
      await makeCtx(pageFor(`pipe`), msg, tm, api).renderEditDocumentGroup()
      await makeCtx(pageFor(`voice`), msg, tm, api).renderEditVoice()
      await makeCtx(pageFor(`anim`), msg, tm, api).renderEditAnimation()
      await makeCtx(pageFor(`vnote`), msg, tm, api).renderEditVideoNote()
      await makeCtx(pageFor(`sticker`), msg, tm, api).renderEditSticker()
      await makeCtx(pageFor(`loc`), msg, tm, api).renderEditLocation()
      await makeCtx(pageFor(`contact`), msg, tm, api).renderEditContact()
      const failing = makeApi()
      failing.editMessageMedia = mock(async () => {
        throw new Error(`too old`)
      })
      await makeCtx(pageFor(`single`), msg, tm, failing).renderEditMedia(`photo`)
      const failingDelete = makeApi()
      failingDelete.editMessageMedia = mock(async () => {
        throw new Error(`too old`)
      })
      failingDelete.deleteMessage = mock(async () => {
        throw new Error(`gone`)
      })
      await makeCtx(pageFor(`single`), msg, tm, failingDelete).renderEditMedia(`photo`)
      await makeCtx(pageFor(`single`), msg, tm, failing).renderEditMedia(`photo`, null, null, null, null, null, `reply`)
      await expect(makeCtx(pageFor(`single`), msg, tm, failing).renderEditMedia(`photo`, null, null, null, null, null, `disable`)).rejects.toThrow(
        `too old`
      )
      expect(api.sendMediaGroup).toHaveBeenCalled()
    } finally {
      await tm.destroy()
    }
  })
})

describe(`ctx-coverage-rich`, () => {
  it(`renders and edits rich messages with fallbacks`, async () => {
    const dir = join(TEST_DIR, `rich`)
    await mkdir(dir, {recursive: true})
    await writeFile(join(dir, `cov.html`), `<g-base><g-message>Rich Hi</g-message></g-base>`)
    const tm = new TemplateManager({path: [dir]})
    try {
      const api = makeApi()
      const msg = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}
      const cbUpdate = {callback_query: {id: `q`, data: `x`, chat_instance: `ci`, message: {message_id: 2, date: 2, text: `m`}}}
      await makeCtx(CovPage, msg, tm, api).renderRich()
      expect(api.sendRichMessage).toHaveBeenCalled()
      await makeCtx(CovPage, msg, tm, api).renderAutoRich()
      await makeCtx(CovPage, cbUpdate, tm, api).renderAutoRich()
      await makeCtx(CovPage, cbUpdate, tm, api).renderEditRich()
      expect(api.editMessageText).toHaveBeenCalled()
      const failing = makeApi()
      failing.editMessageText = mock(async () => {
        throw new Error(`too old`)
      })
      await makeCtx(CovPage, cbUpdate, tm, failing).renderEditRich()
      await makeCtx(CovPage, cbUpdate, tm, failing).renderEditRich(null, null, null, null, null, `reply`)
      await expect(makeCtx(CovPage, cbUpdate, tm, failing).renderEditRich(null, null, null, null, null, `disable`)).rejects.toThrow(`too old`)
    } finally {
      await tm.destroy()
    }
  })
})

describe(`ctx-coverage-session-members`, () => {
  it(`sets and builds chat-member session keys`, async () => {
    const storage = new Map<string, unknown>()
    const cacheSession = {
      get: mock(async (key: string) => (storage.get(key) as unknown) ?? null),
      set: mock(async (key: string, value: unknown) => {
        storage.set(key, value)
        return true
      }),
      delete: mock(async (key: string) => {
        const existed = storage.has(key)
        storage.delete(key)
        return existed
      })
    }
    class SessPage extends Ctx {
      static data = Ctx.buildData({name: `sesscov`})
      async handleSessionChatMemberOutIn() {}
      async handleSessionMyChatMemberOutRegular() {}
      async handleSessionMyChatMemberOutAdmin() {}
      async handleSessionMyChatMemberRegularAdmin() {}
      async handleSessionMyChatMemberAdminRegular() {}
    }
    const ct = {
      api: {config: {use: () => {}}},
      me: {id: 1, is_bot: true, first_name: `Bot`},
      update: {message: {chat: {id: 7, type: `private`}, text: `hi`, from: {id: 3, is_bot: false, first_name: `U`}}}
    } as unknown as ITCtxParams[`ct`]
    const ctx = new SessPage({
      ct,
      cacheSession: cacheSession as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager: {} as unknown as ITCtxParams[`templateManager`],
      temp: {isAnswer: false, session: {}, data: {}}
    }) as never as Ctx & {
      handleSessionChatMemberOutIn: (...a: unknown[]) => unknown
      handleSessionMyChatMemberOutRegular: (...a: unknown[]) => unknown
      handleSessionMyChatMemberOutAdmin: (...a: unknown[]) => unknown
      handleSessionMyChatMemberRegularAdmin: (...a: unknown[]) => unknown
      handleSessionMyChatMemberAdminRegular: (...a: unknown[]) => unknown
    }
    await ctx.setSessionChatMemberOutIn({a: 1})
    await ctx.setSessionMyChatMemberOutRegular()
    await ctx.setSessionMyChatMemberOutAdmin()
    await ctx.setSessionMyChatMemberRegularAdmin()
    await ctx.setSessionMyChatMemberAdminRegular()
    expect(storage.size).toBeGreaterThan(0)
    expect(ctx.methodSessionChatMemberOutIn()).toContain(`sesscov`)
    expect(ctx.methodSessionMyChatMemberOutRegular(`custom`)).toContain(`custom`)
    expect(ctx.methodSessionMyChatMemberOutAdmin()).toContain(`sesscov`)
    expect(ctx.methodSessionMyChatMemberRegularAdmin()).toContain(`sesscov`)
    expect(ctx.methodSessionMyChatMemberAdminRegular()).toContain(`sesscov`)
  })
})

describe(`ctx-coverage-resolve-media-input`, () => {
  it(`passes undefined and empty src through unchanged`, () => {
    expect(Ctx.resolveMediaInput(undefined)).toBeUndefined()
    expect(Ctx.resolveMediaInput(``)).toBe(``)
  })

  it(`passes URL and file_id strings through unchanged`, () => {
    expect(Ctx.resolveMediaInput(`https://example.com/a.jpg`)).toBe(`https://example.com/a.jpg`)
    expect(Ctx.resolveMediaInput(`AgACAgQAAxkBAAM`)).toBe(`AgACAgQAAxkBAAM`)
  })

  it(`passes nonexistent paths through unchanged without throwing`, () => {
    const missing = join(TEST_DIR, `nope.jpg`)
    expect(Ctx.resolveMediaInput(missing)).toBe(missing)
  })

  it(`passes directory paths through unchanged`, async () => {
    const dir = join(TEST_DIR, `media-dir`)
    await mkdir(dir, {recursive: true})
    expect(Ctx.resolveMediaInput(dir)).toBe(dir)
  })

  it(`wraps real files in InputFile and forwards filename`, async () => {
    const dir = join(TEST_DIR, `media`)
    await mkdir(dir, {recursive: true})
    const file = join(dir, `pic.jpg`)
    await writeFile(file, `bytes`)
    const uploaded = Ctx.resolveMediaInput(file)
    expect(uploaded).toBeInstanceOf(InputFile)
    const named = Ctx.resolveMediaInput(file, `custom.jpg`)
    expect(named).toBeInstanceOf(InputFile)
    expect((named as InputFile).filename).toBe(`custom.jpg`)
  })

  it(`uploads local files via renderMedia`, async () => {
    const dir = join(TEST_DIR, `wiring-media`)
    await mkdir(dir, {recursive: true})
    const file = join(dir, `photo.jpg`)
    await writeFile(file, `bytes`)
    const api = makeApi()
    const tm = {getGMedia: mock(() => ({type: `photo`, src: file, caption: `Hi`}))} as never
    const msg = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}
    await makeCtx(CovPage, msg, tm, api).renderMedia(`photo`)
    expect(api.sendPhoto).toHaveBeenCalledTimes(1)
    expect((api.sendPhoto.mock.calls as any)[0][1]).toBeInstanceOf(InputFile)
  })

  it(`uploads local files via renderEditMedia`, async () => {
    const dir = join(TEST_DIR, `wiring-edit`)
    await mkdir(dir, {recursive: true})
    const file = join(dir, `photo.jpg`)
    await writeFile(file, `bytes`)
    const api = makeApi()
    const tm = {getGMedia: mock(() => ({type: `photo`, src: file, caption: `Hi`}))} as never
    const msg = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}
    await makeCtx(CovPage, msg, tm, api).renderEditMedia(`photo`)
    expect(api.editMessageMedia).toHaveBeenCalledTimes(1)
    const payload = (api.editMessageMedia.mock.calls as any)[0][2] as {media: unknown}
    expect(payload.media).toBeInstanceOf(InputFile)
  })

  it(`uploads local files via renderMediaGroup`, async () => {
    const dir = join(TEST_DIR, `wiring-group`)
    await mkdir(dir, {recursive: true})
    const file = join(dir, `photo.jpg`)
    await writeFile(file, `bytes`)
    const api = makeApi()
    const tm = {getGMedia: mock(() => ({type: `group`, mediaGroup: [{type: `photo`, src: file}], caption: `Album`}))} as never
    const msg = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}
    await makeCtx(CovPage, msg, tm, api).renderMediaGroup()
    expect(api.sendMediaGroup).toHaveBeenCalledTimes(1)
    const group = (api.sendMediaGroup.mock.calls as any)[0][1] as Array<{media: unknown}>
    expect(group[0]!.media).toBeInstanceOf(InputFile)
  })

  it(`uploads local files via renderBroadcastMedia`, async () => {
    const dir = join(TEST_DIR, `wiring-broadcast`)
    await mkdir(dir, {recursive: true})
    const file = join(dir, `photo.jpg`)
    await writeFile(file, `bytes`)
    const api = makeApi()
    const tm = {getGMedia: mock(() => ({type: `photo`, src: file, caption: `Hi`}))} as never
    const msg = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}
    await makeCtx(CovPage, msg, tm, api).renderBroadcastMedia([7], [`en`])
    expect(api.sendPhoto).toHaveBeenCalledTimes(1)
    expect((api.sendPhoto.mock.calls as any)[0][1]).toBeInstanceOf(InputFile)
  })

  it(`keeps InputFile filename unless the template defines one`, () => {
    const file = new InputFile(Buffer.from(`bytes`), `a.txt`)
    expect(Ctx.resolveMediaInput(file)).toBe(file)
    expect(file.filename).toBe(`a.txt`)
    expect(Ctx.resolveMediaInput(file, `override.txt`)).toBe(file)
    expect(file.filename).toBe(`override.txt`)
  })

  it(`wraps Buffer payloads in InputFile with optional filename`, () => {
    const buf = Buffer.from(`bytes`)
    const named = Ctx.resolveMediaInput(buf, `a.txt`)
    expect(named).toBeInstanceOf(InputFile)
    expect((named as InputFile).filename).toBe(`a.txt`)
    expect(Ctx.resolveMediaInput(buf)).toBeInstanceOf(InputFile)
  })

  it(`wraps Uint8Array payloads in InputFile`, () => {
    const bytes = new Uint8Array([104, 105])
    const uploaded = Ctx.resolveMediaInput(bytes, `b.bin`)
    expect(uploaded).toBeInstanceOf(InputFile)
    expect((uploaded as InputFile).filename).toBe(`b.bin`)
  })

  it(`delivers Buffer template data as InputFile via renderMedia`, async () => {
    const dir = join(TEST_DIR, `wiring-buffer`)
    await mkdir(dir, {recursive: true})
    await writeFile(join(dir, `doc.html`), `<g-base><g-media type="document" src="{{file}}">cap</g-media></g-base>`)
    const tm = new TemplateManager({path: [dir]})
    try {
      const api = makeApi()
      const msg = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}
      const buf = Buffer.from(`doc-bytes`)
      await makeCtx(pageFor(`doc`), msg, tm, api).renderMedia(`document`, null, {file: buf})
      expect(api.sendDocument).toHaveBeenCalledTimes(1)
      expect((api.sendDocument.mock.calls as any)[0][1]).toBeInstanceOf(InputFile)
    } finally {
      await tm.destroy()
    }
  })

  it(`prefers template filename over InputFile name via renderMedia`, async () => {
    const dir = join(TEST_DIR, `wiring-inputfile-name`)
    await mkdir(dir, {recursive: true})
    await writeFile(join(dir, `doc.html`), `<g-base><g-media type="document" src="{{file}}" filename="from-template.txt">cap</g-media></g-base>`)
    const tm = new TemplateManager({path: [dir]})
    try {
      const api = makeApi()
      const msg = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}
      await makeCtx(pageFor(`doc`), msg, tm, api).renderMedia(`document`, null, {file: new InputFile(Buffer.from(`doc-bytes`), `orig.txt`)})
      expect(api.sendDocument).toHaveBeenCalledTimes(1)
      const sent = (api.sendDocument.mock.calls as any)[0][1] as InputFile
      expect(sent).toBeInstanceOf(InputFile)
      expect(sent.filename).toBe(`from-template.txt`)
    } finally {
      await tm.destroy()
    }
  })
})
