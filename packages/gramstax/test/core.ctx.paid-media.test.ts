import {describe, expect, it, mock} from "bun:test"
import {GrammyError, HttpError, InputFile} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ITPaidMediaBlock} from "~/template/engine"
import type {ITCtxParams} from "~/types/t.ctx"

class PaidMediaPage extends Ctx {
  static data = Ctx.buildData({name: `paidmediapage`})
}

const grammyError = (code: number) => new GrammyError(`Call failed!`, {error_code: code, description: `desc`, parameters: {}} as never, `sendPaidMedia`, {})

const httpError = () => new HttpError(`net down`, new Error(`socket`))

const wall: ITPaidMediaBlock = {
  stars: 100,
  media: [
    {type: `photo`, src: `file_1`, caption: `Bayar untuk membuka`},
    {type: `video`, src: `file_2`}
  ]
}

const makeApi = (overrides?: Record<string, unknown>) => ({
  config: {use: () => {}},
  sendPaidMedia: mock(async () => ({message_id: 7}) as never),
  refundStarPayment: mock(async () => true as never),
  getStarTransactions: mock(async () => ({transactions: []}) as never),
  ...(overrides ?? {})
})

const messageUpdate = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

const noChatUpdate = {message: {message_id: 1, date: 1, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

const makeCtx = (api: Record<string, unknown>, paidMedia: ITPaidMediaBlock, extra?: {log?: unknown; onSendError?: unknown}, update: Record<string, unknown> = messageUpdate) => {
  const tm = {getGPaidMedia: mock(() => paidMedia)} as never
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ITCtxParams[`ct`]
  return new PaidMediaPage({
    ct,
    cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ITCtxParams[`templateManager`],
    log: (extra?.log ?? null) as unknown as ITCtxParams[`log`],
    onSendError: (extra?.onSendError ?? null) as unknown as ITCtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

describe(`paid-media-render`, () => {
  it(`sends Stars-locked media with captions as HTML`, async () => {
    const api = makeApi()
    const kb = {inline_keyboard: []}
    await makeCtx(api, wall).renderPaidMedia(kb as never, {teaser: `t.jpg`})
    expect(api.sendPaidMedia).toHaveBeenCalledTimes(1)
    const args = (api.sendPaidMedia.mock.calls as any)[0]
    expect(args[0]).toBe(1)
    expect(args[1]).toBe(100)
    expect(args[2]).toEqual([
      {type: `photo`, media: `file_1`, caption: `Bayar untuk membuka`, parse_mode: `HTML`},
      {type: `video`, media: `file_2`}
    ])
    expect(args[3]).toMatchObject({reply_markup: kb})
  })

  it(`resolves a local file src into an InputFile upload`, async () => {
    const api = makeApi()
    const local: ITPaidMediaBlock = {stars: 100, media: [{type: `photo`, src: import.meta.path, caption: `Lokal`}]}
    await makeCtx(api, local).renderPaidMedia()
    const args = (api.sendPaidMedia.mock.calls as any)[0]
    expect(args[2][0].media instanceof InputFile).toBe(true)
    expect(args[2][0].caption).toBe(`Lokal`)
    expect(args[2][0].parse_mode).toBe(`HTML`)
  })

  it(`forwards interpolation data to getGPaidMedia`, async () => {
    const api = makeApi()
    const getGPaidMedia = mock(() => wall)
    const tm = {getGPaidMedia} as never
    const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update: messageUpdate} as unknown as ITCtxParams[`ct`]
    const ctx = new PaidMediaPage({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager: tm as ITCtxParams[`templateManager`],
      log: null as unknown as ITCtxParams[`log`],
      onSendError: null as unknown as ITCtxParams[`onSendError`],
      temp: {isAnswer: false, session: {}, data: {}}
    })
    await ctx.renderPaidMedia(null, {teaser: `t.jpg`}, `promo`, {payload: `p`} as never)
    expect((getGPaidMedia.mock.calls as any)[0]).toEqual([`paidmediapage`, `promo`, undefined, {teaser: `t.jpg`}])
    expect((api.sendPaidMedia.mock.calls as any)[0][3]).toMatchObject({payload: `p`})
  })

  it(`throws before any api call when stars are zero`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...wall, stars: 0}).renderPaidMedia()).rejects.toThrow(/1-25000/)
    expect(api.sendPaidMedia).not.toHaveBeenCalled()
  })

  it(`throws before any api call when stars exceed the maximum`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...wall, stars: 25001}).renderPaidMedia()).rejects.toThrow(/1-25000/)
    expect(api.sendPaidMedia).not.toHaveBeenCalled()
  })

  it(`throws before any api call when stars are not an integer`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...wall, stars: 1.5}).renderPaidMedia()).rejects.toThrow(/1-25000/)
    expect(api.sendPaidMedia).not.toHaveBeenCalled()
  })

  it(`throws before any api call when stars are NaN`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...wall, stars: Number.NaN}).renderPaidMedia()).rejects.toThrow(/1-25000/)
    expect(api.sendPaidMedia).not.toHaveBeenCalled()
  })

  it(`throws before any api call when media are empty`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...wall, media: []}).renderPaidMedia()).rejects.toThrow(/1-10 items/)
    expect(api.sendPaidMedia).not.toHaveBeenCalled()
  })

  it(`throws before any api call when media exceed ten items`, async () => {
    const api = makeApi()
    const media = Array.from({length: 11}, () => ({type: `photo`, src: `f`, caption: undefined}))
    await expect(makeCtx(api, {stars: 100, media: media as ITPaidMediaBlock[`media`]}).renderPaidMedia()).rejects.toThrow(/1-10 items/)
    expect(api.sendPaidMedia).not.toHaveBeenCalled()
  })

  it(`throws before any api call when an item type is not photo or video`, async () => {
    const api = makeApi()
    const bad = {stars: 100, media: [{type: `audio`, src: `a.mp3`} as any]}
    await expect(makeCtx(api, bad as ITPaidMediaBlock).renderPaidMedia()).rejects.toThrow(/must be "photo" or "video"/)
    expect(api.sendPaidMedia).not.toHaveBeenCalled()
  })

  it(`throws before any api call when an item src is empty`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...wall, media: [{type: `photo`, src: ``}]}).renderPaidMedia()).rejects.toThrow(/src must be non-empty/)
    expect(api.sendPaidMedia).not.toHaveBeenCalled()
  })

  it(`throws before any api call when a caption overflows`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...wall, media: [{type: `photo`, src: `f`, caption: `C`.repeat(1025)}]}).renderPaidMedia()).rejects.toThrow(/at most 1024/)
    expect(api.sendPaidMedia).not.toHaveBeenCalled()
  })

  it(`throws when no chat id is available`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, wall, undefined, noChatUpdate).renderPaidMedia()).rejects.toThrow(/chat id/)
    expect(api.sendPaidMedia).not.toHaveBeenCalled()
  })

  it(`notifies fallback-text with page kind chatId and rethrows the original 403 error`, async () => {
    const err = grammyError(403)
    const seen: Array<{err: unknown; info: unknown}> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendPaidMedia: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, wall, {
        log: {warn, error},
        onSendError: (e: unknown, info: unknown) => {
          seen.push({err: e, info})
        }
      }).renderPaidMedia()
    ).rejects.toBe(err)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `paidmediapage`, kind: `fallback-text`, chatId: 1})
    expect(warn).toHaveBeenCalledTimes(1)
    expect((warn.mock.calls as any)[0][0]).toContain(`paidmediapage`)
    expect(error).not.toHaveBeenCalled()
  })

  it(`notifies retryable with error log and rethrows the original transport error`, async () => {
    const err = httpError()
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendPaidMedia: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, wall, {
        log: {warn, error},
        onSendError: (_e: unknown, info: unknown) => {
          seen.push(info)
        }
      }).renderPaidMedia()
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `paidmediapage`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
    const msg = (error.mock.calls as any)[0][0] as string
    expect(msg).toContain(`paidmediapage`)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe(`stars-refund`, () => {
  it(`refunds a Stars payment by user and charge id`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, wall).refundStars(123, `ch_1`)
    expect(result).toBe(true)
    expect(api.refundStarPayment).toHaveBeenCalledTimes(1)
    expect((api.refundStarPayment.mock.calls as any)[0]).toEqual([123, `ch_1`])
  })
})

describe(`stars-transactions`, () => {
  it(`lists Stars transactions with options`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, wall).getStarTransactions({limit: 100})
    expect(result).toEqual({transactions: []})
    expect(api.getStarTransactions).toHaveBeenCalledTimes(1)
    expect((api.getStarTransactions.mock.calls as any)[0]).toEqual([{limit: 100}])
  })

  it(`lists Stars transactions without options`, async () => {
    const api = makeApi()
    await makeCtx(api, wall).getStarTransactions()
    expect((api.getStarTransactions.mock.calls as any)[0]).toEqual([{}])
  })
})
