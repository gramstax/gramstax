import {describe, expect, it, mock} from "bun:test"
import {GrammyError, HttpError, InputFile} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

class PhasePage extends Ctx {
  static data = Ctx.buildData({name: `phase3`})
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
  ...(overrides ?? {})
})

const makeCtx = (tm: unknown, api: Record<string, unknown>) => {
  const update = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ICtxParams[`ct`]
  return new PhasePage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ICtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

const makeTextCtx = (api: Record<string, unknown>, msg = `hello`) => makeCtx({getGMessage: mock(() => ({kind: `message`, text: msg, rich: false})), getGMedia: mock(() => undefined)}, api)

const makeMediaCtx = (med: unknown, api: Record<string, unknown>) => makeCtx({getGMessage: mock(() => ({kind: `message`, text: `hello`, rich: false})), getGMedia: mock(() => med)}, api)

const photoMed = (extra?: Record<string, unknown>) => ({type: `photo`, src: `pic.jpg`, caption: `Hi`, ...(extra ?? {})})

const sentIds = (api: Record<string, unknown>, method: string) => (api[method] as {mock: {calls: Array<Array<unknown>>}}).mock.calls.map((call) => call[0])

describe(`broadcast-resume`, () => {
  it(`startFrom skips already-sent text recipients without duplicates`, async () => {
    const api = makeApi()
    const res = await makeTextCtx(api).renderBroadcast({ids: [1, 2, 3, 4], languageCode: [`en`, `en`, `en`, `en`], throwError: false, startFrom: 2})
    expect(res).toEqual({successCount: 2, failedCount: 0, totalCount: 4, skippedCount: 2, retryable: []})
    expect(api.sendMessage).toHaveBeenCalledTimes(2)
    expect(sentIds(api, `sendMessage`)).toEqual([3, 4])
  })

  it(`startFrom past the end attempts nothing`, async () => {
    const api = makeApi()
    const res = await makeTextCtx(api).renderBroadcast({ids: [1, 2], languageCode: [`en`, `en`], throwError: false, startFrom: 10})
    expect(res).toEqual({successCount: 0, failedCount: 0, totalCount: 2, skippedCount: 2, retryable: []})
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it(`startFrom skips already-sent media recipients`, async () => {
    const api = makeApi()
    const res = await makeMediaCtx(photoMed(), api).renderBroadcastMedia({ids: [1, 2, 3], languageCode: [`en`, `en`, `en`], throwError: false, startFrom: 1})
    expect(res).toEqual({successCount: 2, failedCount: 0, totalCount: 3, skippedCount: 1, retryable: []})
    expect(api.sendPhoto).toHaveBeenCalledTimes(2)
    expect(sentIds(api, `sendPhoto`)).toEqual([2, 3])
  })

  it(`non-finite and negative startFrom values start at zero`, async () => {
    for (const start of [-5, Number.NaN, Number.NEGATIVE_INFINITY]) {
      const api = makeApi()
      const res = await makeTextCtx(api).renderBroadcast({ids: [1, 2], languageCode: [`en`, `en`], throwError: false, startFrom: start})
      expect(res.successCount).toBe(2)
      expect(res.skippedCount).toBe(0)
      expect(api.sendMessage).toHaveBeenCalledTimes(2)
    }
  })
})

describe(`broadcast-progress`, () => {
  it(`fires per chunk plus final with exact counts for text`, async () => {
    const api = makeApi()
    const progress = mock(() => {})
    const res = await makeTextCtx(api).renderBroadcast({ids: [1, 2, 3, 4, 5], languageCode: [`en`, `en`, `en`, `en`, `en`], throwError: false, chunkSize: 2, chunkDelayMs: 1, onProgress: progress})
    expect(res.successCount).toBe(5)
    expect(progress.mock.calls as Array<Array<number>>).toEqual([
      [2, 5],
      [4, 5],
      [5, 5]
    ])
  })

  it(`fires once at completion when no chunking applies`, async () => {
    const api = makeApi()
    const progress = mock(async () => {})
    const res = await makeTextCtx(api).renderBroadcast({ids: [1, 2, 3], languageCode: [`en`, `en`, `en`], throwError: false, onProgress: progress})
    expect(res.successCount).toBe(3)
    expect(progress.mock.calls as Array<Array<number>>).toEqual([[3, 3]])
  })

  it(`fires per chunk plus final with exact counts for media`, async () => {
    const api = makeApi()
    const progress = mock(() => {})
    const res = await makeMediaCtx(photoMed(), api).renderBroadcastMedia({ids: [1, 2, 3, 4], languageCode: [`en`, `en`, `en`, `en`], throwError: false, chunkSize: 2, chunkDelayMs: 1, onProgress: progress})
    expect(res.successCount).toBe(4)
    expect(progress.mock.calls as Array<Array<number>>).toEqual([
      [2, 4],
      [4, 4]
    ])
  })

  it(`fires at the free-limit boundary and at completion for text`, async () => {
    const api = makeApi()
    const progress = mock(() => {})
    const ids = Array.from({length: 30}, (_, i) => i + 1)
    const langs = Array.from({length: 30}, () => `en`)
    const res = await makeTextCtx(api).renderBroadcast({ids, languageCode: langs, throwError: false, onProgress: progress})
    expect(res.successCount).toBe(30)
    expect(progress.mock.calls as Array<Array<number>>).toEqual([
      [30, 30],
      [30, 30]
    ])
  })

  it(`fires at the free-limit boundary and at completion for media`, async () => {
    const api = makeApi()
    const progress = mock(() => {})
    const ids = Array.from({length: 30}, (_, i) => i + 1)
    const langs = Array.from({length: 30}, () => `en`)
    const res = await makeMediaCtx(photoMed(), api).renderBroadcastMedia({ids, languageCode: langs, throwError: false, onProgress: progress})
    expect(res.successCount).toBe(30)
    expect(progress.mock.calls as Array<Array<number>>).toEqual([
      [30, 30],
      [30, 30]
    ])
  })
})

describe(`broadcast-concurrency`, () => {
  it(`delivers all text recipients with aligned per-language messages`, async () => {
    const api = makeApi()
    const tm = {getGMessage: mock((...args: Array<unknown>) => ({kind: `message`, text: args[2] as string, rich: false})), getGMedia: mock(() => undefined)}
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    const langs = ids.map((id) => `m${id - 1}`)
    const res = await makeCtx(tm, api).renderBroadcast({ids, languageCode: langs, throwError: false, concurrency: 3})
    expect(res).toEqual({successCount: 9, failedCount: 0, totalCount: 9, skippedCount: 0, retryable: []})
    expect(api.sendMessage).toHaveBeenCalledTimes(9)
    const calls = (api.sendMessage.mock.calls as Array<Array<unknown>>).slice().sort((a, b) => (a[0] as number) - (b[0] as number))
    for (const call of calls) expect(call[1]).toBe(`m${(call[0] as number) - 1}`)
  })

  it(`normalizes degenerate worker counts to the sequential loop`, async () => {
    for (const workers of [0, -4, Number.NaN, Number.POSITIVE_INFINITY]) {
      const api = makeApi()
      const res = await makeTextCtx(api).renderBroadcast({ids: [1, 2, 3], languageCode: [`en`, `en`, `en`], throwError: false, concurrency: workers})
      expect(res.successCount).toBe(3)
      expect(sentIds(api, `sendMessage`)).toEqual([1, 2, 3])
    }
  })

  it(`caps huge worker counts and floors fractions while delivering all`, async () => {
    for (const workers of [2.7, 3, 100]) {
      const api = makeApi()
      const res = await makeTextCtx(api).renderBroadcast({ids: [1, 2, 3], languageCode: [`en`, `en`, `en`], throwError: false, concurrency: workers})
      expect(res.successCount).toBe(3)
      expect(sentIds(api, `sendMessage`).slice().sort()).toEqual([1, 2, 3])
    }
  })

  it(`delivers all media recipients across lanes while honoring excludes`, async () => {
    const api = makeApi()
    const res = await makeMediaCtx(photoMed(), api).renderBroadcastMedia({ids: [1, 2, 3, 4, 5, 6], languageCode: [`en`, `en`, `en`, `en`, `en`, `en`], throwError: false, excludeIds: [2, 5], concurrency: 3})
    expect(res).toEqual({successCount: 4, failedCount: 0, totalCount: 6, skippedCount: 2, retryable: []})
    expect(api.sendPhoto).toHaveBeenCalledTimes(4)
    expect(sentIds(api, `sendPhoto`).slice().sort()).toEqual([1, 3, 4, 6])
  })

  it(`never shares one InputFile instance across parallel media sends`, async () => {
    const file = new InputFile(Buffer.from(`bytes`), `orig.bin`)
    const api = makeApi()
    const res = await makeMediaCtx({type: `document`, src: file, caption: `Docs`}, api).renderBroadcastMedia({ids: [1, 2], languageCode: [`en`, `en`], throwError: false, concurrency: 2})
    expect(res.successCount).toBe(2)
    expect(api.sendDocument).toHaveBeenCalledTimes(2)
    const first = (api.sendDocument.mock.calls as Array<Array<unknown>>)[0]![1] as InputFile
    const second = (api.sendDocument.mock.calls as Array<Array<unknown>>)[1]![1] as InputFile
    expect(first).not.toBe(file)
    expect(second).not.toBe(file)
    expect(first).not.toBe(second)
    expect(first.filename).toBe(`orig.bin`)
    expect(second.filename).toBe(`orig.bin`)
    expect(file.filename).toBe(`orig.bin`)
  })
})

describe(`broadcast-retryable`, () => {
  it(`separates retryable text failures while the loop continues`, async () => {
    const err429 = grammyError(429, {retry_after: 1})
    const err403 = grammyError(403)
    const httpErr = new HttpError(`net down`, new Error(`socket`))
    const api = makeApi({
      sendMessage: mock(async (id: number, text: string) => {
        if (text === `Media unavailable`) return {message_id: 9} as never
        if (id === 2) throw err429
        if (id === 3) throw err403
        if (id === 4) throw httpErr
        return {message_id: 9} as never
      })
    })
    const progress = mock(() => {})
    const res = await makeTextCtx(api).renderBroadcast({ids: [1, 2, 3, 4, 5], languageCode: [`en`, `en`, `en`, `en`, `en`], throwError: false, onProgress: progress})
    expect(res.successCount).toBe(2)
    expect(res.failedCount).toBe(3)
    expect(res.totalCount).toBe(5)
    expect(res.retryable.length).toBe(2)
    expect(res.retryable[0]).toEqual({index: 1, id: 2, error: err429})
    expect(res.retryable[1]).toEqual({index: 3, id: 4, error: httpErr})
    expect(api.sendMessage).toHaveBeenCalledTimes(6)
    expect(api.sendMessage).toHaveBeenNthCalledWith(4, 3, `Media unavailable`)
    expect(progress.mock.calls as Array<Array<number>>).toEqual([[5, 5]])
  })

  it(`keeps firstError as the first failure of any kind on throw`, async () => {
    const err429 = grammyError(429)
    const err403 = grammyError(403)
    const api = makeApi({
      sendMessage: mock(async (id: number, text: string) => {
        if (text === `Media unavailable`) return {message_id: 9} as never
        if (id === 1) throw err429
        throw err403
      })
    })
    const thrown = (await makeTextCtx(api)
      .renderBroadcast({ids: [1, 2], languageCode: [`en`, `en`], throwError: true})
      .catch((error: unknown) => error)) as {failedCount: number; retryable: Array<{index: number; id: number; error: unknown}>; err: unknown}
    expect(thrown.failedCount).toBe(2)
    expect(thrown.retryable.length).toBe(1)
    expect(thrown.retryable[0]).toEqual({index: 0, id: 1, error: err429})
    expect(thrown.err).toBe(err429)
  })

  it(`separates retryable media failures without fallback sends`, async () => {
    const err429 = grammyError(429)
    const err400 = grammyError(400)
    const api = makeApi({
      sendPhoto: mock(async (id: number) => {
        if (id === 1) throw err429
        throw err400
      })
    })
    const res = await makeMediaCtx(photoMed(), api).renderBroadcastMedia({ids: [1, 2], languageCode: [`en`, `en`]})
    expect(res.successCount).toBe(0)
    expect(res.failedCount).toBe(2)
    expect(res.retryable).toEqual([{index: 0, id: 1, error: err429}])
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect((api.sendMessage.mock.calls as Array<Array<unknown>>)[0]![0]).toBe(2)
  })

  it(`reports retryable media entries when throwing`, async () => {
    const err = grammyError(503)
    const api = makeApi({
      sendPhoto: mock(async () => {
        throw err
      })
    })
    const thrown = (await makeMediaCtx(photoMed(), api)
      .renderBroadcastMedia({ids: [1], languageCode: [`en`], throwError: true})
      .catch((error: unknown) => error)) as {failedCount: number; retryable: Array<{index: number; id: number; error: unknown}>; err: unknown}
    expect(thrown.failedCount).toBe(1)
    expect(thrown.retryable.length).toBe(1)
    expect(thrown.err).toBe(err)
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it(`records missing template media as retryable without fallback`, async () => {
    const api = makeApi()
    const res = await makeMediaCtx(undefined, api).renderBroadcastMedia({ids: [1], languageCode: [`en`]})
    expect(res.successCount).toBe(0)
    expect(res.failedCount).toBe(1)
    expect(res.retryable.length).toBe(1)
    expect(res.retryable[0]!.index).toBe(0)
    expect(res.retryable[0]!.id).toBe(1)
    expect(api.sendPhoto).not.toHaveBeenCalled()
    expect(api.sendMessage).not.toHaveBeenCalled()
  })
})

describe(`broadcast-backward-compat`, () => {
  it(`keeps the default text call sequence byte-identical`, async () => {
    const err400 = grammyError(400)
    const api = makeApi({
      sendMessage: mock(async (id: number, text: string) => {
        if (text === `Media unavailable`) return {message_id: 9} as never
        if (id === 3) throw err400
        return {message_id: 9} as never
      })
    })
    const res = await makeTextCtx(api).renderBroadcast({ids: [1, 2, 3], languageCode: [`en`], throwError: false, excludeIds: [2]})
    expect(res).toEqual({successCount: 1, failedCount: 1, totalCount: 3, skippedCount: 1, retryable: []})
    expect(api.sendMessage).toHaveBeenCalledTimes(3)
    expect(api.sendMessage).toHaveBeenNthCalledWith(1, 1, `hello`, expect.objectContaining({parse_mode: `HTML`}))
    expect(api.sendMessage).toHaveBeenNthCalledWith(2, 3, `hello`, expect.objectContaining({parse_mode: `HTML`}))
    expect(api.sendMessage).toHaveBeenNthCalledWith(3, 3, `Media unavailable`)
  })

  it(`counts empty template text as failed without sending`, async () => {
    const api = makeApi()
    const res = await makeTextCtx(api, ``).renderBroadcast({ids: [1], languageCode: [`en`]})
    expect(res).toEqual({successCount: 0, failedCount: 1, totalCount: 1, skippedCount: 0, retryable: []})
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it(`keeps the default media call sequence and result shape`, async () => {
    const api = makeApi()
    const res = await makeMediaCtx(photoMed(), api).renderBroadcastMedia({ids: [1, 2], languageCode: [`en`, `en`]})
    expect(res).toEqual({successCount: 2, failedCount: 0, totalCount: 2, skippedCount: 0, retryable: []})
    expect(api.sendPhoto).toHaveBeenCalledTimes(2)
    expect(api.sendPhoto).toHaveBeenNthCalledWith(1, 1, `pic.jpg`, expect.objectContaining({caption: `Hi`, parse_mode: `HTML`}))
    expect(api.sendPhoto).toHaveBeenNthCalledWith(2, 2, `pic.jpg`, expect.objectContaining({caption: `Hi`, parse_mode: `HTML`}))
  })
})
