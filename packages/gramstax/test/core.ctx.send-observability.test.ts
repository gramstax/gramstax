import {afterEach, describe, expect, it, mock} from "bun:test"
import {mkdir, rm, writeFile} from "node:fs/promises"
import {join} from "node:path"
import {GrammyError, InputFile} from "grammy"
import {Gramstax} from "~/core/bot"
import {Ctx} from "~/core/ctx"
import type {ICt, ICtxParams, ISendErrorInfo} from "~/types/ctx"

const TEST_DIR = join(import.meta.dir, `ctx_send_phase45`)

afterEach(async () => {
  await rm(TEST_DIR, {recursive: true, force: true})
})

class JailPage extends Ctx {
  static data = Ctx.buildData({name: `jailpage`})
}

const grammyError = (code: number) => new GrammyError(`Call failed!`, {error_code: code, description: `desc`, parameters: {}} as never, `sendPhoto`, {})

const makeApi = (overrides?: Record<string, unknown>) => ({
  config: {use: () => {}},
  sendMessage: mock(async () => ({message_id: 9}) as never),
  sendPhoto: mock(async () => ({message_id: 1}) as never),
  sendVideo: mock(async () => ({message_id: 1}) as never),
  sendAudio: mock(async () => ({message_id: 1}) as never),
  sendDocument: mock(async () => ({message_id: 1}) as never),
  sendAnimation: mock(async () => ({message_id: 1}) as never),
  sendVoice: mock(async () => ({message_id: 1}) as never),
  sendVideoNote: mock(async () => ({message_id: 1}) as never),
  sendSticker: mock(async () => ({message_id: 1}) as never),
  sendLocation: mock(async () => ({message_id: 1}) as never),
  sendContact: mock(async () => ({message_id: 1}) as never),
  sendMediaGroup: mock(async () => [{message_id: 1}] as never),
  editMessageMedia: mock(async () => ({message_id: 1}) as never),
  editMessageText: mock(async () => ({message_id: 1}) as never),
  sendRichMessage: mock(async () => ({message_id: 1}) as never),
  deleteMessage: mock(async () => true as never),
  ...(overrides ?? {})
})

const makeCtx = (med: unknown, api: Record<string, unknown>, extra?: {log?: unknown; mediaRoots?: string[] | null; onSendError?: unknown}) => {
  const tm = {getGMedia: mock(() => med), getGMessage: mock(() => ({kind: `message`, text: `hello`, rich: false}))} as never
  const update = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ICtxParams[`ct`]
  return new JailPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ICtxParams[`templateManager`],
    log: (extra?.log ?? null) as unknown as ICtxParams[`log`],
    mediaRoots: extra?.mediaRoots ?? null,
    onSendError: (extra?.onSendError ?? null) as unknown as ICtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

const photoMed = (extra?: Record<string, unknown>) => ({type: `photo`, src: `pic.jpg`, caption: `Hi`, ...(extra ?? {})})

const setupDirs = async () => {
  const allowed = join(TEST_DIR, `allowed`)
  const elsewhere = join(TEST_DIR, `elsewhere`)
  await mkdir(allowed, {recursive: true})
  await mkdir(elsewhere, {recursive: true})
  const inside = join(allowed, `pic.jpg`)
  const outside = join(elsewhere, `secret.jpg`)
  await writeFile(inside, `bytes`)
  await writeFile(outside, `bytes`)
  return {allowed, inside, outside}
}

describe(`jail-static`, () => {
  it(`allows paths under a root, the root itself, and rejects siblings sharing a prefix`, () => {
    expect(Ctx.isPathUnderRoots(join(`r`, `a.jpg`), [`r`])).toBe(true)
    expect(Ctx.isPathUnderRoots(`r`, [`r`])).toBe(true)
    expect(Ctx.isPathUnderRoots(join(`r2`, `a.jpg`), [`r`])).toBe(false)
    expect(Ctx.isPathUnderRoots(join(`r`, `..`, `out.jpg`), [`r`])).toBe(false)
    expect(Ctx.isPathUnderRoots(join(`b`, `a.jpg`), [`a`, `b`])).toBe(true)
  })

  it(`uploads inside roots and passes outside roots through as file_id`, async () => {
    const {allowed, inside, outside} = await setupDirs()
    expect(Ctx.resolveMediaInput(inside, undefined, [allowed])).toBeInstanceOf(InputFile)
    expect(Ctx.resolveMediaInput(outside, undefined, [allowed])).toBe(outside)
  })

  it(`keeps current behavior when roots are unset, null, or empty`, async () => {
    const {inside} = await setupDirs()
    expect(Ctx.resolveMediaInput(inside)).toBeInstanceOf(InputFile)
    expect(Ctx.resolveMediaInput(inside, undefined, null)).toBeInstanceOf(InputFile)
    expect(Ctx.resolveMediaInput(inside, undefined, [])).toBeInstanceOf(InputFile)
  })

  it(`leaves URL, file_id, missing paths, and binary payloads untouched even with jail set`, async () => {
    const {allowed} = await setupDirs()
    const missing = join(TEST_DIR, `nope.jpg`)
    expect(Ctx.resolveMediaInput(`https://example.com/a.jpg`, undefined, [allowed])).toBe(`https://example.com/a.jpg`)
    expect(Ctx.resolveMediaInput(`AgACAgQAAxkBAAM`, undefined, [allowed])).toBe(`AgACAgQAAxkBAAM`)
    expect(Ctx.resolveMediaInput(missing, undefined, [allowed])).toBe(missing)
    expect(Ctx.resolveMediaInput(Buffer.from(`x`), `a.txt`, [allowed])).toBeInstanceOf(InputFile)
    const file = new InputFile(Buffer.from(`x`), `a.txt`)
    expect(Ctx.resolveMediaInput(file, undefined, [allowed])).toBe(file)
  })

  it(`ignores the trailing roots param when cloning`, () => {
    const file = new InputFile(Buffer.from(`x`), `a.txt`)
    const clone = Ctx.cloneMediaInput(file, [`r`])
    expect(clone).not.toBe(file)
    expect(clone).toBeInstanceOf(InputFile)
    expect(Ctx.cloneMediaInput(`a.jpg`, [`r`])).toBe(`a.jpg`)
  })
})

describe(`jail-instance`, () => {
  it(`uploads absolute paths when the jail is unset (non-breaking)`, async () => {
    const {inside} = await setupDirs()
    const api = makeApi()
    await makeCtx({type: `photo`, src: inside, caption: `Hi`}, api).renderMedia({type: `photo`})
    expect(api.sendPhoto).toHaveBeenCalledTimes(1)
    expect((api.sendPhoto.mock.calls as any)[0][1]).toBeInstanceOf(InputFile)
  })

  it(`denies outside paths as file_id with a warn and no upload attempt`, async () => {
    const {allowed, outside} = await setupDirs()
    const warn = mock(() => {})
    const api = makeApi()
    await makeCtx({type: `photo`, src: outside, caption: `Hi`}, api, {log: {warn}, mediaRoots: [allowed]}).renderMedia({type: `photo`})
    expect(api.sendPhoto).toHaveBeenCalledTimes(1)
    expect((api.sendPhoto.mock.calls as any)[0][1]).toBe(outside)
    expect(warn).toHaveBeenCalledTimes(1)
    expect((warn.mock.calls as any)[0][0]).toContain(outside)
  })

  it(`uploads inside paths with no warn`, async () => {
    const {allowed, inside} = await setupDirs()
    const warn = mock(() => {})
    const api = makeApi()
    await makeCtx({type: `photo`, src: inside, caption: `Hi`}, api, {log: {warn}, mediaRoots: [allowed]}).renderMedia({type: `photo`})
    expect((api.sendPhoto.mock.calls as any)[0][1]).toBeInstanceOf(InputFile)
    expect(warn).not.toHaveBeenCalled()
  })

  it(`denies silently when log is absent and leaves URL/file_id alone with jail set`, async () => {
    const {allowed, outside} = await setupDirs()
    const api = makeApi()
    await makeCtx({type: `photo`, src: outside, caption: `Hi`}, api, {mediaRoots: [allowed]}).renderMedia({type: `photo`})
    expect((api.sendPhoto.mock.calls as any)[0][1]).toBe(outside)
    await makeCtx({type: `photo`, src: `https://example.com/a.jpg`, caption: `Hi`}, api, {mediaRoots: [allowed]}).renderMedia({type: `photo`})
    expect((api.sendPhoto.mock.calls as any)[1][1]).toBe(`https://example.com/a.jpg`)
  })

  it(`denies group items as file_id strings via renderMediaGroup`, async () => {
    const {allowed, outside} = await setupDirs()
    const warn = mock(() => {})
    const group = {type: `group`, mediaGroup: [{type: `photo`, src: outside}], caption: `Cap`}
    const api = makeApi()
    await makeCtx(group, api, {log: {warn}, mediaRoots: [allowed]}).renderMediaGroup()
    expect(api.sendMediaGroup).toHaveBeenCalledTimes(1)
    const payload = (api.sendMediaGroup.mock.calls as any)[0][1] as Array<Record<string, unknown>>
    expect(payload[0]!.media).toBe(outside)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it(`propagates mediaRoots through new SomePage(this)`, async () => {
    const {allowed, inside} = await setupDirs()
    const api = makeApi()
    const first = makeCtx(photoMed(), api, {mediaRoots: [allowed]})
    const second = new JailPage(first)
    expect(second.mediaRoots).toEqual([allowed])
    expect(second.resolveMedia(inside)).toBeInstanceOf(InputFile)
  })
})

describe(`observe-log`, () => {
  it(`warns with page context on fallback-text delivery`, async () => {
    const warn = mock(() => {})
    const api = makeApi({
      sendPhoto: mock(async () => {
        throw grammyError(400)
      })
    })
    await makeCtx(photoMed(), api, {log: {warn}}).renderMedia({type: `photo`})
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect((warn.mock.calls as any)[0][0]).toContain(`jailpage`)
  })

  it(`errors with page and chat context on rethrown send errors`, async () => {
    const error = mock(() => {})
    const err = grammyError(500)
    const api = makeApi({
      sendPhoto: mock(async () => {
        throw err
      })
    })
    await expect(makeCtx(photoMed(), api, {log: {error}}).renderMedia({type: `photo`})).rejects.toBe(err)
    expect(error).toHaveBeenCalledTimes(1)
    const msg = (error.mock.calls as any)[0][0] as string
    expect(msg).toContain(`jailpage`)
    expect(msg).toContain(`1`)
  })

  it(`warns on media-group fallback for both group and srcList branches`, async () => {
    const group = {type: `group`, mediaGroup: [{type: `photo`, src: `a.jpg`}], caption: `Cap`}
    const warnGroup = mock(() => {})
    const apiGroup = makeApi({
      sendMediaGroup: mock(async () => {
        throw grammyError(400)
      })
    })
    await makeCtx(group, apiGroup, {log: {warn: warnGroup}}).renderMediaGroup()
    expect(warnGroup).toHaveBeenCalledTimes(1)
    const pipe = {type: `photo`, srcList: [`a.jpg`, `b.jpg`], caption: `Album`}
    const warnPipe = mock(() => {})
    const apiPipe = makeApi({
      sendMediaGroup: mock(async () => {
        throw grammyError(400)
      })
    })
    await makeCtx(pipe, apiPipe, {log: {warn: warnPipe}}).renderMediaGroup({type: `photo`})
    expect(warnPipe).toHaveBeenCalledTimes(1)
  })

  it(`warns per recipient on broadcast fallback and stays quiet on retryable`, async () => {
    const err = grammyError(400)
    const warn = mock(() => {})
    const api = makeApi({
      sendPhoto: mock(async () => {
        throw err
      })
    })
    const res = await makeCtx(photoMed(), api, {log: {warn}}).renderBroadcastMedia({ids: [7, 8], languageCode: [`en`, `en`]})
    expect(res.failedCount).toBe(2)
    expect(warn).toHaveBeenCalledTimes(2)
    const retryApi = makeApi({
      sendPhoto: mock(async () => {
        throw grammyError(500)
      })
    })
    const warnRetry = mock(() => {})
    const retryRes = await makeCtx(photoMed(), retryApi, {log: {warn: warnRetry}}).renderBroadcastMedia({ids: [7], languageCode: [`en`]})
    expect(retryRes.retryable.length).toBe(1)
    expect(warnRetry).not.toHaveBeenCalled()
  })

  it(`warns on text broadcast fallback`, async () => {
    const warn = mock(() => {})
    const api = makeApi({
      sendMessage: mock(async (_id: number, text: string) => {
        if (text === `Media unavailable`) return {message_id: 9} as never
        throw grammyError(400)
      })
    })
    const tm = {getGMessage: mock(() => ({kind: `message`, text: `hello`, rich: false}))} as never
    const update = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}
    const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ICtxParams[`ct`]
    const ctx = new JailPage({
      ct,
      cacheSession: {} as unknown as ICtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager: tm as ICtxParams[`templateManager`],
      log: {warn} as unknown as ICtxParams[`log`],
      temp: {isAnswer: false, session: {}, data: {}}
    })
    await ctx.renderBroadcast({ids: [7], languageCode: [`en`]})
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it(`warns on every edit fallback path`, async () => {
    const failingEdit = () =>
      makeApi({
        editMessageMedia: mock(async () => {
          throw new Error(`too old`)
        })
      })
    const warnMedia = mock(() => {})
    await makeCtx(photoMed(), failingEdit(), {log: {warn: warnMedia}}).renderMedia({type: `photo`, mode: `edit`})
    expect(warnMedia).toHaveBeenCalledTimes(1)
    expect((warnMedia.mock.calls as any)[0][0]).toContain(`jailpage`)
    const failingText = () =>
      makeApi({
        editMessageText: mock(async () => {
          throw new Error(`too old`)
        })
      })
    const warnEdit = mock(() => {})
    const tm = {getGMessage: mock(() => ({kind: `message`, text: `hello`, rich: false})), getGMedia: mock(() => photoMed())} as never
    const update = {callback_query: {id: `q`, data: `x`, chat_instance: `ci`, message: {message_id: 2, date: 2, text: `m`, chat: {id: 1, type: `private`}}}}
    const mkEditCtx = (api: Record<string, unknown>, log: unknown) => {
      const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ICtxParams[`ct`]
      return new JailPage({
        ct,
        cacheSession: {} as unknown as ICtxParams[`cacheSession`],
        cacheKeyboard: new Map(),
        templateManager: tm as ICtxParams[`templateManager`],
        log: log as unknown as ICtxParams[`log`],
        temp: {isAnswer: false, session: {}, data: {}}
      })
    }
    await mkEditCtx(failingText(), {warn: warnEdit}).renderText({mode: `edit`})
    expect(warnEdit).toHaveBeenCalledTimes(1)
    const warnRich = mock(() => {})
    await mkEditCtx(failingText(), {warn: warnRich}).renderText({mode: `edit`})
    expect(warnRich).toHaveBeenCalledTimes(1)
    const group = {type: `group`, mediaGroup: [{type: `photo`, src: `a.jpg`}], caption: `Cap`}
    const tmGroup = {getGMessage: mock(() => ({kind: `message`, text: `hello`, rich: false})), getGMedia: mock(() => group)} as never
    const mkGroupCtx = (api: Record<string, unknown>, log: unknown) => {
      const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ICtxParams[`ct`]
      return new JailPage({
        ct,
        cacheSession: {} as unknown as ICtxParams[`cacheSession`],
        cacheKeyboard: new Map(),
        templateManager: tmGroup as ICtxParams[`templateManager`],
        log: log as unknown as ICtxParams[`log`],
        temp: {isAnswer: false, session: {}, data: {}}
      })
    }
    const warnGroupEdit = mock(() => {})
    const errorGroupEdit = mock(() => {})
    const groupErr = grammyError(500)
    const groupApi = makeApi({
      deleteMessage: mock(async () => {
        throw new Error(`gone`)
      }),
      sendMediaGroup: mock(async () => {
        throw groupErr
      })
    })
    await expect(mkGroupCtx(groupApi, {warn: warnGroupEdit, error: errorGroupEdit}).renderMediaGroup({mode: `edit`})).rejects.toBe(groupErr)
    expect(warnGroupEdit).toHaveBeenCalledTimes(1)
    expect((warnGroupEdit.mock.calls as any)[0][0]).toContain(`fallback re-send`)
    expect(errorGroupEdit).toHaveBeenCalledTimes(2)
  })

  it(`warns when the last-resort fallback delivery also fails`, async () => {
    const warn = mock(() => {})
    const api = makeApi({
      sendMessage: mock(async () => {
        throw new Error(`gone`)
      })
    })
    await expect(makeCtx(photoMed(), api, {log: {warn}}).replyFallbackText()).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect((warn.mock.calls as any)[0][0]).toContain(`jailpage`)
  })
})

describe(`observe-hook`, () => {
  it(`invokes the hook with page, kind, and chatId on fallback-text`, async () => {
    const seen: Array<{err: unknown; info: unknown}> = []
    const api = makeApi({
      sendPhoto: mock(async () => {
        throw grammyError(400)
      })
    })
    await makeCtx(photoMed(), api, {
      onSendError: (err: unknown, info: unknown) => {
        seen.push({err, info})
      }
    }).renderMedia({type: `photo`})
    expect(seen.length).toBe(1)
    expect(seen[0]!.info).toEqual({page: `jailpage`, kind: `fallback-text`, chatId: 1})
  })

  it(`invokes the hook on retryable before rethrowing`, async () => {
    const seen: Array<unknown> = []
    const err = grammyError(503)
    const api = makeApi({
      sendPhoto: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(photoMed(), api, {
        onSendError: (_err: unknown, info: unknown) => {
          seen.push(info)
        }
      }).renderMedia({type: `photo`})
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `jailpage`, kind: `retryable`, chatId: 1}])
  })

  it(`invokes the hook per recipient on both broadcast outcomes`, async () => {
    const seen: Array<unknown> = []
    const hook = (_err: unknown, info: unknown) => {
      seen.push(info)
    }
    let calls = 0
    const api = makeApi({
      sendPhoto: mock(async () => {
        calls += 1
        if (calls === 1) throw grammyError(400)
        throw grammyError(500)
      })
    })
    const res = await makeCtx(photoMed(), api, {onSendError: hook}).renderBroadcastMedia({ids: [7, 8], languageCode: [`en`, `en`]})
    expect(res.failedCount).toBe(2)
    expect(seen).toEqual([
      {page: `jailpage`, kind: `fallback-text`, chatId: 7},
      {page: `jailpage`, kind: `retryable`, chatId: 8}
    ])
  })

  it(`swallows a throwing hook without breaking the send flow`, async () => {
    const api = makeApi({
      sendPhoto: mock(async () => {
        throw grammyError(400)
      })
    })
    const result = await makeCtx(photoMed(), api, {
      onSendError: (() => {
        throw new Error(`hook boom`)
      }) as never
    }).renderMedia({type: `photo`})
    expect(result).toEqual({message_id: 9})
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
  })

  it(`never invokes the hook for validation throws`, async () => {
    const hook = mock(() => {})
    const api = makeApi()
    await expect(makeCtx(photoMed(), api, {onSendError: hook}).renderMedia({type: `bogus` as never})).rejects.toThrow(/Unknown media type/)
    await expect(makeCtx({type: `photo`, src: Buffer.alloc(11 * 1024 * 1024), caption: `Hi`}, api, {onSendError: hook}).renderMedia({type: `photo`})).rejects.toThrow(/exceeds limit/)
    expect(hook).not.toHaveBeenCalled()
  })
})

describe(`observe-bot-channel`, () => {
  class SendHookBot extends Gramstax {
    seen: Array<{err: unknown; info: unknown}> = []
    override hookSendError = (err: unknown, info: ISendErrorInfo): void => {
      this.seen.push({err, info})
    }
  }

  class ThisBot extends Gramstax {
    seenSelf: unknown = undefined
    seen: Array<{err: unknown; info: unknown}> = []
    override hookSendError(err: unknown, info: ISendErrorInfo): void {
      this.seenSelf = this
      this.seen.push({err, info})
    }
  }

  const makeBotCt = (api: Record<string, unknown>): ICt =>
    ({
      api,
      me: {id: 9, is_bot: true, first_name: `Bot`},
      update: {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}
    }) as unknown as ICt

  it(`forwards mediaRoots and hookSendError from Gramstax into createCtx`, () => {
    const bot = new SendHookBot({token: `123:abc`, deploy: `raw`, log: false, mediaRoots: [`r`]})
    expect(bot.mediaRoots).toEqual([`r`])
    const ctx = bot.createCtx(makeBotCt(makeApi()))
    expect(ctx.mediaRoots).toEqual([`r`])
    expect(typeof ctx.onSendError).toBe(`function`)
    const err = new Error(`x`)
    const info = {page: `p`, kind: `fallback-text`, chatId: 1} as ISendErrorInfo
    ctx.onSendError?.(err, info)
    expect(bot.seen).toEqual([{err, info}])
  })

  it(`defaults both channels to null`, () => {
    const bot = new Gramstax({token: `123:abc`, deploy: `raw`, log: false})
    expect(bot.mediaRoots).toBeNull()
    expect(bot.hookSendError).toBeUndefined()
    const ctx = bot.createCtx(makeBotCt(makeApi()))
    expect(ctx.onSendError).toBeNull()
  })

  it(`binds method-form hookSendError through a real send so subclass this works`, async () => {
    const bot = new ThisBot({token: `123:abc`, deploy: `raw`, log: false})
    bot.ctxScope.templateManager = {getGMedia: () => photoMed(), getGMessage: () => `hello`} as never
    const api = makeApi({
      sendPhoto: mock(async () => {
        throw grammyError(400)
      })
    })
    const ctx = bot.createCtx(makeBotCt(api))
    ;(ctx as unknown as {data: {name: string}}).data = {name: `hookpage`}
    await ctx.renderMedia({type: `photo`})
    expect(bot.seen.length).toBe(1)
    expect(bot.seenSelf).toBe(bot)
    expect(bot.seen[0]!.info).toEqual({page: `hookpage`, kind: `fallback-text`, chatId: 1})
  })
})
