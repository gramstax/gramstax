import {afterEach, describe, expect, it, mock} from "bun:test"
import {mkdir, rm, writeFile} from "node:fs/promises"
import {join} from "node:path"
import {GrammyError, HttpError, InputFile} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ITCtxParams} from "~/types/t.ctx"

const TEST_DIR = join(import.meta.dir, `ctx_send_hardening`)

afterEach(async () => {
  await rm(TEST_DIR, {recursive: true, force: true})
})

class HardPage extends Ctx {
  static data = Ctx.buildData({name: `hardening`})
}

const grammyError = (code: number, params?: Record<string, unknown>) => new GrammyError(`Call failed!`, {error_code: code, description: `desc`, parameters: params ?? {}} as never, `sendPhoto`, {})

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
  deleteMessage: mock(async () => true as never),
  ...(overrides ?? {})
})

const makeCtx = (med: unknown, api: Record<string, unknown>, log?: unknown) => {
  const tm = {getGMedia: mock(() => med), getGMessage: mock(() => `hello`)} as never
  const update = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ITCtxParams[`ct`]
  return new HardPage({
    ct,
    cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ITCtxParams[`templateManager`],
    log: (log ?? null) as ITCtxParams[`log`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

const photoMed = (extra?: Record<string, unknown>) => ({type: `photo`, src: `pic.jpg`, caption: `Hi`, ...(extra ?? {})})

describe(`send-taxonomy`, () => {
  it(`maps 4xx client errors to fallback-text`, () => {
    for (const code of [400, 401, 403, 404, 422, 499]) expect(Ctx.classifySendError(grammyError(code))).toBe(`fallback-text`)
  })

  it(`maps 429, 5xx, transport, and unknown errors to retryable`, () => {
    for (const code of [429, 500, 502, 503]) expect(Ctx.classifySendError(grammyError(code))).toBe(`retryable`)
    expect(Ctx.classifySendError(new HttpError(`net down`, new Error(`socket`)))).toBe(`retryable`)
    expect(Ctx.classifySendError(new Error(`boom`))).toBe(`retryable`)
    expect(Ctx.classifySendError(null)).toBe(`retryable`)
    expect(Ctx.classifySendError(undefined)).toBe(`retryable`)
    expect(Ctx.classifySendError(`oops`)).toBe(`retryable`)
  })

  it(`extracts retry_after seconds as milliseconds`, () => {
    expect(Ctx.retryAfterMs(grammyError(429, {retry_after: 5}))).toBe(5000)
    expect(Ctx.retryAfterMs(grammyError(400, {}))).toBeUndefined()
    expect(Ctx.retryAfterMs(grammyError(429, {retry_after: `soon`}))).toBeUndefined()
    expect(Ctx.retryAfterMs(new HttpError(`net down`, new Error(`socket`)))).toBeUndefined()
    expect(Ctx.retryAfterMs(new Error(`boom`))).toBeUndefined()
  })
})

describe(`send-fallback-text`, () => {
  it(`exposes the framework default and per-page override`, () => {
    expect(Ctx.FALLBACK_TEXT).toBe(`Media unavailable`)
    const api = makeApi()
    const ctx = makeCtx(photoMed(), api)
    expect(ctx.resolveFallbackText()).toBe(`Media unavailable`)
    ctx.fallbackText = `Custom down`
    expect(ctx.resolveFallbackText()).toBe(`Custom down`)
    ctx.fallbackText = null
    expect(ctx.resolveFallbackText()).toBe(`Media unavailable`)
  })

  it(`renderMedia replies fallback text on 400 and returns it`, async () => {
    const err = grammyError(400)
    const api = makeApi({
      sendPhoto: mock(async () => {
        throw err
      })
    })
    const result = await makeCtx(photoMed(), api).renderMedia(`photo`)
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect((api.sendMessage.mock.calls as any)[0][1]).toBe(`Media unavailable`)
    expect(result).toEqual({message_id: 9})
  })

  it(`renderMedia uses the per-page fallbackText override`, async () => {
    const err = grammyError(403)
    const api = makeApi({
      sendPhoto: mock(async () => {
        throw err
      })
    })
    const ctx = makeCtx(photoMed(), api)
    ctx.fallbackText = `Coba lagi nanti`
    await ctx.renderMedia(`photo`)
    expect((api.sendMessage.mock.calls as any)[0][1]).toBe(`Coba lagi nanti`)
  })

  it(`renderMedia rethrows the original retryable error untouched`, async () => {
    const err = grammyError(500)
    const api = makeApi({
      sendPhoto: mock(async () => {
        throw err
      })
    })
    await expect(makeCtx(photoMed(), api).renderMedia(`photo`)).rejects.toBe(err)
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it(`renderMediaGroup replies fallback text on 400 and rethrows on 500`, async () => {
    const group = {type: `group`, mediaGroup: [{type: `photo`, src: `a.jpg`}], caption: `Cap`}
    const errFallback = grammyError(400)
    const apiFallback = makeApi({
      sendMediaGroup: mock(async () => {
        throw errFallback
      })
    })
    await makeCtx(group, apiFallback).renderMediaGroup()
    expect((apiFallback.sendMessage.mock.calls as any)[0][1]).toBe(`Media unavailable`)
    const errRetry = grammyError(503)
    const apiRetry = makeApi({
      sendMediaGroup: mock(async () => {
        throw errRetry
      })
    })
    await expect(makeCtx(group, apiRetry).renderMediaGroup()).rejects.toBe(errRetry)
    expect(apiRetry.sendMessage).not.toHaveBeenCalled()
  })

  it(`replyFallbackText ignores nested failure and returns undefined`, async () => {
    const api = makeApi({
      sendMessage: mock(async () => {
        throw new Error(`gone`)
      })
    })
    await expect(makeCtx(photoMed(), api).replyFallbackText()).resolves.toBeUndefined()
  })
})

describe(`send-fail-fast-units`, () => {
  it(`assertMediaSize enforces per-type limits`, () => {
    expect(Ctx.MEDIA_UPLOAD_LIMITS.photo).toBe(10 * 1024 * 1024)
    expect(Ctx.MEDIA_UPLOAD_LIMITS.document).toBe(50 * 1024 * 1024)
    expect(Ctx.MEDIA_UPLOAD_LIMITS.sticker).toBe(512 * 1024)
    expect(() => Ctx.assertMediaSize(`photo`, 10 * 1024 * 1024)).not.toThrow()
    expect(() => Ctx.assertMediaSize(`photo`, 10 * 1024 * 1024 + 1)).toThrow(/exceeds limit/)
    expect(() => Ctx.assertMediaSize(`location`, 10 ** 12)).not.toThrow()
  })

  it(`assertMediaSrcSize skips unknowable sources`, () => {
    expect(() => Ctx.assertMediaSrcSize(`photo`, new InputFile(Buffer.from(`x`), `a.txt`))).not.toThrow()
    expect(() => Ctx.assertMediaSrcSize(`photo`, `AgACAgQAAxkBAAM`)).not.toThrow()
    expect(() => Ctx.assertMediaSrcSize(`photo`, `https://example.com/a.jpg`)).not.toThrow()
    expect(() => Ctx.assertMediaSrcSize(`photo`, undefined)).not.toThrow()
    expect(() => Ctx.assertMediaSrcSize(`location`, `whatever`)).not.toThrow()
  })

  it(`assertMediaSrcSize measures Buffer and Uint8Array payloads`, () => {
    expect(() => Ctx.assertMediaSrcSize(`photo`, Buffer.alloc(1024))).not.toThrow()
    expect(() => Ctx.assertMediaSrcSize(`photo`, Buffer.alloc(11 * 1024 * 1024))).toThrow(/Media photo size .* exceeds limit/)
    expect(() => Ctx.assertMediaSrcSize(`photo`, new Uint8Array(16))).not.toThrow()
  })

  it(`assertMediaSrcSize measures local files and skips directories`, async () => {
    const dir = join(TEST_DIR, `sizes`)
    await mkdir(dir, {recursive: true})
    const small = join(dir, `small.webp`)
    await writeFile(small, Buffer.alloc(1024))
    expect(() => Ctx.assertMediaSrcSize(`sticker`, small)).not.toThrow()
    expect(() => Ctx.assertMediaSrcSize(`photo`, dir)).not.toThrow()
  })

  it(`assertMediaCaption enforces 1024 only for caption-carrying types`, () => {
    expect(() => Ctx.assertMediaCaption(`photo`, `x`.repeat(1024))).not.toThrow()
    expect(() => Ctx.assertMediaCaption(`photo`, `x`.repeat(1025))).toThrow(/Caption length 1025 exceeds limit 1024/)
    expect(() => Ctx.assertMediaCaption(`sticker`, `x`.repeat(5000))).not.toThrow()
    expect(() => Ctx.assertMediaCaption(`photo`, undefined)).not.toThrow()
    expect(() => Ctx.assertMediaCaption(`photo`, 123)).not.toThrow()
  })

  it(`assertMediaPreconditions rejects unknown types and voice captions`, () => {
    expect(() => Ctx.assertMediaPreconditions(`bogus`, {src: `a.jpg`})).toThrow(/Unknown media type: bogus/)
    expect(() => Ctx.assertMediaPreconditions(`voice`, {src: `v.ogg`, caption: `hi`})).toThrow(/voice messages do not support captions/)
    expect(() => Ctx.assertMediaPreconditions(`voice`, {src: `v.ogg`})).not.toThrow()
    expect(() => Ctx.assertMediaPreconditions(`photo`, {src: `a.jpg`, caption: `Hi`})).not.toThrow()
  })

  it(`assertMediaGroupItems and assertMediaSrcList enforce the group limit`, () => {
    const items = Array.from({length: 3}, (_, i) => ({type: `photo`, src: `p${i}.jpg`}))
    expect(() => Ctx.assertMediaGroupItems(items)).not.toThrow()
    expect(() => Ctx.assertMediaGroupItems([...items, ...items, ...items, ...items])).toThrow(/Media group size 12 exceeds limit 10/)
    expect(() => Ctx.assertMediaGroupItems([{type: `sticker`, src: `s.webp`}])).toThrow(/Unknown media type: sticker/)
    expect(() => Ctx.assertMediaGroupItems([{type: `photo`, src: Buffer.alloc(11 * 1024 * 1024)}])).toThrow(/exceeds limit/)
    expect(() => Ctx.assertMediaSrcList(`photo`, [`a.jpg`, `b.jpg`])).not.toThrow()
    expect(() =>
      Ctx.assertMediaSrcList(
        `photo`,
        Array.from({length: 11}, (_, i) => `p${i}.jpg`)
      )
    ).toThrow(/Media group size 11 exceeds limit 10/)
  })

  it(`assertLocation parses and range-checks coordinates`, () => {
    expect(Ctx.assertLocation(`1.5`, `2.5`)).toEqual({latitude: 1.5, longitude: 2.5})
    expect(Ctx.assertLocation(1, -179.9)).toEqual({latitude: 1, longitude: -179.9})
    expect(() => Ctx.assertLocation(`abc`, `2`)).toThrow(/Invalid latitude/)
    expect(() => Ctx.assertLocation(undefined, undefined)).toThrow(/Invalid latitude/)
    expect(() => Ctx.assertLocation(``, `2`)).toThrow(/Invalid latitude/)
    expect(() => Ctx.assertLocation(91, 0)).toThrow(/Invalid latitude/)
    expect(() => Ctx.assertLocation(0, 181)).toThrow(/Invalid longitude/)
    expect(() => Ctx.assertLocation(0, `NaNish`)).toThrow(/Invalid longitude/)
  })

  it(`assertContact requires non-empty phone and first_name`, () => {
    expect(() => Ctx.assertContact(`+100`, `A`)).not.toThrow()
    expect(() => Ctx.assertContact(``, `A`)).toThrow(/non-empty "phone"/)
    expect(() => Ctx.assertContact(`+100`, `  `)).toThrow(/non-empty "first_name"/)
    expect(() => Ctx.assertContact(123, `A`)).toThrow(/non-empty "phone"/)
  })
})

describe(`send-fail-fast-wiring`, () => {
  it(`renderMedia throws on unknown type before any send`, async () => {
    const api = makeApi()
    await expect(makeCtx(photoMed(), api).renderMedia(`bogus` as never)).rejects.toThrow(/Unknown media type: bogus/)
    expect(api.sendPhoto).not.toHaveBeenCalled()
  })

  it(`renderMedia rejects oversized local files via statSync`, async () => {
    const dir = join(TEST_DIR, `wiring-size`)
    await mkdir(dir, {recursive: true})
    const big = join(dir, `big.webp`)
    await writeFile(big, Buffer.alloc(600 * 1024))
    const api = makeApi()
    await expect(makeCtx({type: `sticker`, src: big}, api).renderMedia(`sticker`)).rejects.toThrow(/Media sticker size .* exceeds limit/)
    expect(api.sendSticker).not.toHaveBeenCalled()
  })

  it(`renderMedia rejects oversized Buffer payloads`, async () => {
    const api = makeApi()
    await expect(makeCtx({type: `photo`, src: Buffer.alloc(11 * 1024 * 1024), caption: `Hi`}, api).renderMedia(`photo`)).rejects.toThrow(/exceeds limit/)
    expect(api.sendPhoto).not.toHaveBeenCalled()
  })

  it(`renderMedia rejects captions over 1024`, async () => {
    const api = makeApi()
    await expect(makeCtx(photoMed({caption: `x`.repeat(1025)}), api).renderMedia(`photo`)).rejects.toThrow(/Caption length 1025 exceeds limit 1024/)
    expect(api.sendPhoto).not.toHaveBeenCalled()
  })

  it(`renderMedia validates location and contact before sending`, async () => {
    const apiLoc = makeApi()
    await expect(makeCtx({type: `location`, latitude: `bad`, longitude: `2`}, apiLoc).renderMedia(`location`)).rejects.toThrow(/Invalid latitude/)
    expect(apiLoc.sendLocation).not.toHaveBeenCalled()
    const apiContact = makeApi()
    await expect(makeCtx({type: `contact`, phone: ``, first_name: `A`}, apiContact).renderMedia(`contact`)).rejects.toThrow(/non-empty "phone"/)
    expect(apiContact.sendContact).not.toHaveBeenCalled()
  })

  it(`renderMedia sends validated location and contact`, async () => {
    const api = makeApi()
    await makeCtx({type: `location`, latitude: `1.5`, longitude: 2.5}, api).renderMedia(`location`)
    expect(api.sendLocation).toHaveBeenCalledTimes(1)
    expect((api.sendLocation.mock.calls as any)[0][1]).toBe(1.5)
    expect((api.sendLocation.mock.calls as any)[0][2]).toBe(2.5)
    await makeCtx({type: `contact`, phone: `+100`, first_name: `A`, vcard: `vc`}, api).renderMedia(`contact`)
    expect(api.sendContact).toHaveBeenCalledTimes(1)
  })

  it(`renderMedia throws for voice with caption instead of silently dropping it`, async () => {
    const api = makeApi()
    await expect(makeCtx({type: `voice`, src: `v.ogg`, caption: `hi`}, api).renderMedia(`voice`)).rejects.toThrow(/voice messages do not support captions/)
    expect(api.sendVoice).not.toHaveBeenCalled()
  })

  it(`renderMediaGroup rejects oversized groups and srcLists`, async () => {
    const big = {type: `group`, mediaGroup: Array.from({length: 11}, (_, i) => ({type: `photo`, src: `p${i}.jpg`})), caption: `Cap`}
    const api = makeApi()
    await expect(makeCtx(big, api).renderMediaGroup()).rejects.toThrow(/Media group size 11 exceeds limit 10/)
    expect(api.sendMediaGroup).not.toHaveBeenCalled()
    const pipe = {type: `photo`, srcList: Array.from({length: 11}, (_, i) => `p${i}.jpg`), caption: `Album`}
    await expect(makeCtx(pipe, api).renderMediaGroup(`photo`)).rejects.toThrow(/Media group size 11 exceeds limit 10/)
  })

  it(`renderBroadcastMedia fail-fast throws before any recipient send`, async () => {
    const api = makeApi()
    await expect(makeCtx({type: `voice`, src: `v.ogg`, caption: `hi`}, api).renderBroadcastMedia([1, 2], [`en`, `en`])).rejects.toThrow(/voice messages do not support captions/)
    expect(api.sendVoice).not.toHaveBeenCalled()
  })
})

describe(`send-broadcast-fallback`, () => {
  it(`delivers fallback text per recipient on 400 and preserves counts`, async () => {
    const err = grammyError(400)
    let calls = 0
    const api = makeApi({
      sendPhoto: mock(async () => {
        calls += 1
        if (calls === 1) throw err
        return {message_id: 1} as never
      })
    })
    const res = await makeCtx(photoMed(), api).renderBroadcastMedia([1, 2], [`en`, `en`])
    expect(res).toEqual({successCount: 1, failedCount: 1, totalCount: 2, skippedCount: 0, retryable: []})
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect((api.sendMessage.mock.calls as any)[0][0]).toBe(1)
    expect((api.sendMessage.mock.calls as any)[0][1]).toBe(`Media unavailable`)
  })

  it(`skips fallback delivery on retryable errors`, async () => {
    const err = grammyError(500)
    const api = makeApi({
      sendPhoto: mock(async () => {
        throw err
      })
    })
    const res = await makeCtx(photoMed(), api).renderBroadcastMedia([1], [`en`])
    expect(res.failedCount).toBe(1)
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it(`renderBroadcast delivers fallback text on 400 for text sends`, async () => {
    const api = makeApi({
      sendMessage: mock(async (_id: number, text: string) => {
        if (text === `Media unavailable`) return {message_id: 9} as never
        throw grammyError(400)
      })
    })
    const tm = {getGMessage: mock(() => `hello`)} as never
    const update = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}
    const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ITCtxParams[`ct`]
    const ctx = new HardPage({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager: tm as ITCtxParams[`templateManager`],
      temp: {isAnswer: false, session: {}, data: {}}
    })
    const res = await ctx.renderBroadcast([1], [`en`])
    expect(res.failedCount).toBe(1)
    expect(api.sendMessage).toHaveBeenCalledTimes(2)
  })
})

describe(`send-clone-identity`, () => {
  it(`never mutates shared InputFile instances across broadcast recipients`, async () => {
    const file = new InputFile(Buffer.from(`bytes`), `orig.txt`)
    const api = makeApi()
    await makeCtx({type: `document`, src: file, filename: `tpl.txt`, caption: `Docs`}, api).renderBroadcastMedia([1, 2], [`en`, `en`])
    expect(api.sendDocument).toHaveBeenCalledTimes(2)
    const first = (api.sendDocument.mock.calls as any)[0][1] as InputFile
    const second = (api.sendDocument.mock.calls as any)[1][1] as InputFile
    expect(first).not.toBe(file)
    expect(second).not.toBe(file)
    expect(first.filename).toBe(`tpl.txt`)
    expect(second.filename).toBe(`tpl.txt`)
    expect(file.filename).toBe(`orig.txt`)
  })
})

describe(`send-group-basename`, () => {
  it(`passes group items through without per-item filename (grammy basename auto-guess)`, async () => {
    const group = {
      type: `group`,
      mediaGroup: [
        {type: `photo`, src: `a.jpg`},
        {type: `photo`, src: `b.jpg`}
      ],
      caption: `Cap`
    }
    const api = makeApi()
    await makeCtx(group, api).renderMediaGroup()
    expect(api.sendMediaGroup).toHaveBeenCalledTimes(1)
    const payload = (api.sendMediaGroup.mock.calls as any)[0][1] as Array<Record<string, unknown>>
    expect(payload[0]!.media).toBe(`a.jpg`)
    expect(`filename` in payload[0]!).toBe(false)
    expect(payload[1]!.media).toBe(`b.jpg`)
  })
})

describe(`send-edit-fallback`, () => {
  it(`renderEditMedia falls back to fallback text when the resend also fails with 400`, async () => {
    const editErr = grammyError(400)
    const sendErr = grammyError(400)
    const api = makeApi({
      editMessageMedia: mock(async () => {
        throw editErr
      }),
      sendPhoto: mock(async () => {
        throw sendErr
      })
    })
    await makeCtx(photoMed(), api).renderEditMedia(`photo`)
    expect(api.deleteMessage).toHaveBeenCalledTimes(1)
    expect((api.sendMessage.mock.calls as any)[0][1]).toBe(`Media unavailable`)
  })

  it(`renderEditMedia rethrows retryable resend failures`, async () => {
    const sendErr = grammyError(500)
    const api = makeApi({
      editMessageMedia: mock(async () => {
        throw grammyError(400)
      }),
      sendPhoto: mock(async () => {
        throw sendErr
      })
    })
    await expect(makeCtx(photoMed(), api).renderEditMedia(`photo`)).rejects.toBe(sendErr)
  })

  it(`renderEditMedia warns when edit options are dropped by the fallback`, async () => {
    const warn = mock(() => {})
    const failing = makeApi({
      editMessageMedia: mock(async () => {
        throw new Error(`too old`)
      })
    })
    await makeCtx(photoMed(), failing, {warn}).renderEditMedia(`photo`, null, null, null, {caption: `x`} as never, null)
    expect(warn).toHaveBeenCalledTimes(2)
    expect((warn.mock.calls as any)[0][0]).toContain(`drops edit options`)
    expect((warn.mock.calls as any)[1][0]).toContain(`fallback re-send`)
    const warn2 = mock(() => {})
    const failing2 = makeApi({
      editMessageMedia: mock(async () => {
        throw new Error(`too old`)
      })
    })
    await makeCtx(photoMed(), failing2, {warn: warn2}).renderEditMedia(`photo`, null, null, null, null, {business_connection_id: `b`} as never)
    expect(warn2).toHaveBeenCalledTimes(2)
    const warn3 = mock(() => {})
    const failing3 = makeApi({
      editMessageMedia: mock(async () => {
        throw new Error(`too old`)
      })
    })
    await makeCtx(photoMed(), failing3, {warn: warn3}).renderEditMedia(`photo`)
    expect(warn3).toHaveBeenCalledTimes(1)
    expect((warn3.mock.calls as any)[0][0]).toContain(`fallback re-send`)
  })

  it(`renderEditMediaGroup honors fallbackEdit modes`, async () => {
    const group = {type: `group`, mediaGroup: [{type: `photo`, src: `a.jpg`}], caption: `Cap`}
    const okApi = makeApi()
    await makeCtx(group, okApi).renderEditMediaGroup()
    expect(okApi.deleteMessage).toHaveBeenCalledTimes(1)
    expect(okApi.sendMediaGroup).toHaveBeenCalledTimes(1)
    const sendErr = grammyError(500)
    const disableApi = makeApi({
      sendMediaGroup: mock(async () => {
        throw sendErr
      })
    })
    await expect(makeCtx(group, disableApi).renderEditMediaGroup(null, null, null, null, `disable`)).rejects.toBe(sendErr)
    expect(disableApi.deleteMessage).toHaveBeenCalledTimes(1)
    expect(disableApi.sendMediaGroup).toHaveBeenCalledTimes(1)
    const replyApi = makeApi({
      sendMediaGroup: mock(async () => {
        throw sendErr
      })
    })
    await expect(makeCtx(group, replyApi).renderEditMediaGroup(null, null, null, null, `reply`)).rejects.toBe(sendErr)
    expect(replyApi.deleteMessage).toHaveBeenCalledTimes(1)
    expect(replyApi.sendMediaGroup).toHaveBeenCalledTimes(2)
    const retryApi = makeApi({
      sendMediaGroup: mock(async () => {
        throw sendErr
      })
    })
    await expect(makeCtx(group, retryApi).renderEditMediaGroup()).rejects.toBe(sendErr)
    expect(retryApi.deleteMessage).toHaveBeenCalledTimes(2)
    expect(retryApi.sendMediaGroup).toHaveBeenCalledTimes(2)
  })

  it(`renderEditMediaGroup tolerates delete failure and still sends`, async () => {
    const group = {type: `group`, mediaGroup: [{type: `photo`, src: `a.jpg`}], caption: `Cap`}
    const api = makeApi({
      deleteMessage: mock(async () => {
        throw new Error(`gone`)
      })
    })
    await makeCtx(group, api).renderEditMediaGroup()
    expect(api.sendMediaGroup).toHaveBeenCalledTimes(1)
  })

  it(`edit-group convenience wrappers forward fallbackEdit`, async () => {
    const group = {type: `group`, mediaGroup: [{type: `photo`, src: `a.jpg`}], caption: `Cap`}
    const sendErr = grammyError(500)
    const api = makeApi({
      sendMediaGroup: mock(async () => {
        throw sendErr
      })
    })
    await expect(makeCtx(group, api).renderEditPhotoGroup(null, null, null, `disable`)).rejects.toBe(sendErr)
    expect(api.deleteMessage).toHaveBeenCalledTimes(1)
  })
})
