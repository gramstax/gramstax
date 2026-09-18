import {describe, expect, it, mock} from "bun:test"
import {GrammyError, HttpError} from "grammy"
import {Ctx} from "~/core/ctx"
import {TemplateEngine} from "~/template/engine"
import type {ITDiceBlock, ITPollBlock, ITVenueBlock} from "~/template/engine"
import type {ITCtxParams} from "~/types/t.ctx"

class ExtraPage extends Ctx {
  static data = Ctx.buildData({name: `extrapage`})
}

const grammyError = (code: number) => new GrammyError(`Call failed!`, {error_code: code, description: `desc`, parameters: {}} as never, `sendPoll`, {})

const httpError = () => new HttpError(`net down`, new Error(`socket`))

const regularPoll: ITPollBlock = {type: `regular`, question: `Pick one?`, options: [`Alpha`, `Beta`], anonymous: true}

const quizPoll: ITPollBlock = {type: `quiz`, question: `What is 2+2?`, options: [`3`, `4`], correct: 1, explanation: `Arithmetic`, anonymous: true}

const messageUpdate = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

const noChatUpdate = {message: {message_id: 1, date: 1, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

const makeApi = (overrides?: Record<string, unknown>) => ({
  config: {use: () => {}},
  sendPoll: mock(async () => ({message_id: 7}) as never),
  sendMessage: mock(async () => ({message_id: 9}) as never),
  sendLocation: mock(async () => ({message_id: 3}) as never),
  sendVenue: mock(async () => ({message_id: 4}) as never),
  sendDice: mock(async () => ({message_id: 5}) as never),
  stopMessageLiveLocation: mock(async () => true as never),
  ...(overrides ?? {})
})

const makeCtx = (tm: unknown, api: Record<string, unknown>, extra?: {log?: unknown; onSendError?: unknown}, update: Record<string, unknown> = messageUpdate) => {
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ITCtxParams[`ct`]
  return new ExtraPage({
    ct,
    cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ITCtxParams[`templateManager`],
    log: (extra?.log ?? null) as unknown as ITCtxParams[`log`],
    onSendError: (extra?.onSendError ?? null) as unknown as ITCtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

const makePollCtx = (api: Record<string, unknown>, poll: ITPollBlock, extra?: {log?: unknown; onSendError?: unknown}) => makeCtx({getGPoll: mock(() => poll), getGMedia: mock(() => undefined)}, api, extra)

const makeMediaCtx = (api: Record<string, unknown>, med: unknown, extra?: {log?: unknown; onSendError?: unknown}) => makeCtx({getGPoll: mock(() => regularPoll), getGMedia: mock(() => med)}, api, extra)

describe(`broadcast-poll`, () => {
  it(`sends a regular poll to every recipient with parse mode and anonymity`, async () => {
    const api = makeApi()
    const kb = {inline_keyboard: []}
    const res = await makePollCtx(api, regularPoll).renderBroadcastPoll([1, 2, 3], [`en`, `en`, `en`], kb as never, {topic: `x`})
    expect(res).toEqual({successCount: 3, failedCount: 0, totalCount: 3, skippedCount: 0, retryable: []})
    expect(api.sendPoll).toHaveBeenCalledTimes(3)
    const calls = api.sendPoll.mock.calls as any
    expect(calls.map((c: any) => c[0])).toEqual([1, 2, 3])
    expect(calls[0][1]).toBe(`Pick one?`)
    expect(calls[0][2]).toEqual([`Alpha`, `Beta`])
    expect(calls[0][3]).toMatchObject({question_parse_mode: `HTML`, type: `regular`, is_anonymous: true, reply_markup: kb})
  })

  it(`forwards quiz grading fields per recipient`, async () => {
    const api = makeApi()
    const res = await makePollCtx(api, quizPoll).renderBroadcastPoll([1, 2], [`en`, `id`])
    expect(res.successCount).toBe(2)
    const args = (api.sendPoll.mock.calls as any)[0]
    expect(args[3]).toMatchObject({type: `quiz`, correct_option_id: 1, explanation: `Arithmetic`, explanation_parse_mode: `HTML`})
  })

  it(`startFrom skips already-sent recipients without duplicates`, async () => {
    const api = makeApi()
    const res = await makePollCtx(api, regularPoll).renderBroadcastPoll([1, 2, 3, 4], [`en`, `en`, `en`, `en`], null, null, null, null, false, null, null, null, null, 2)
    expect(res).toEqual({successCount: 2, failedCount: 0, totalCount: 4, skippedCount: 2, retryable: []})
    expect(api.sendPoll).toHaveBeenCalledTimes(2)
    expect((api.sendPoll.mock.calls as any).map((c: any) => c[0])).toEqual([3, 4])
  })

  it(`excludeIds skips listed recipients`, async () => {
    const api = makeApi()
    const res = await makePollCtx(api, regularPoll).renderBroadcastPoll([1, 2, 3], [`en`, `en`, `en`], null, null, null, null, false, null, null, [2])
    expect(res).toEqual({successCount: 2, failedCount: 0, totalCount: 3, skippedCount: 1, retryable: []})
    expect((api.sendPoll.mock.calls as any).map((c: any) => c[0])).toEqual([1, 3])
  })

  it(`records retryable failures and continues the loop`, async () => {
    const err = httpError()
    const api = makeApi({
      sendPoll: mock(async (id: number) => {
        if (id === 2) throw err
        return {message_id: 7} as never
      })
    })
    const res = await makePollCtx(api, regularPoll).renderBroadcastPoll([1, 2, 3], [`en`, `en`, `en`])
    expect(res.successCount).toBe(2)
    expect(res.failedCount).toBe(1)
    expect(res.retryable.length).toBe(1)
    expect(res.retryable[0]!.index).toBe(1)
    expect(res.retryable[0]!.id).toBe(2)
    expect(res.retryable[0]!.error).toBe(err)
  })

  it(`delivers fallback text on fallback-text failures and keeps going`, async () => {
    const api = makeApi({
      sendPoll: mock(async () => {
        throw grammyError(403)
      })
    })
    const res = await makePollCtx(api, regularPoll).renderBroadcastPoll([1, 2], [`en`, `en`])
    expect(res).toEqual({successCount: 0, failedCount: 2, totalCount: 2, skippedCount: 0, retryable: []})
    expect(api.sendPoll).toHaveBeenCalledTimes(2)
    expect(api.sendMessage).toHaveBeenCalledTimes(2)
  })

  it(`notifies the hook per failed recipient`, async () => {
    const err = httpError()
    const seen: Array<unknown> = []
    const api = makeApi({
      sendPoll: mock(async () => {
        throw err
      })
    })
    await makePollCtx(api, regularPoll, {onSendError: (_e: unknown, info: unknown) => {
      seen.push(info)
    }}).renderBroadcastPoll([5], [`en`])
    expect(seen).toEqual([{page: `extrapage`, kind: `retryable`, chatId: 5}])
  })

  it(`throws before any api call when the poll is invalid`, async () => {
    const api = makeApi()
    await expect(makePollCtx(api, {...regularPoll, question: `Q`.repeat(301)}).renderBroadcastPoll([1], [`en`])).rejects.toThrow(/1-300/)
    expect(api.sendPoll).not.toHaveBeenCalled()
  })

  it(`counts a missing poll template as a retryable failure`, async () => {
    const api = makeApi()
    const res = await makePollCtx(api, regularPoll).renderBroadcastPoll([1], [])
    expect(res.successCount).toBe(0)
    expect(res.failedCount).toBe(1)
    expect(res.retryable.length).toBe(1)
    expect(api.sendPoll).not.toHaveBeenCalled()
  })

  it(`fans out across concurrency lanes`, async () => {
    const api = makeApi()
    const res = await makePollCtx(api, regularPoll).renderBroadcastPoll([1, 2, 3, 4], [`en`, `en`, `en`, `en`], null, null, null, null, false, null, null, null, null, 0, 2)
    expect(res).toEqual({successCount: 4, failedCount: 0, totalCount: 4, skippedCount: 0, retryable: []})
    expect(api.sendPoll).toHaveBeenCalledTimes(4)
  })

  it(`fires per chunk plus final with exact counts`, async () => {
    const api = makeApi()
    const progress = mock(() => {})
    const res = await makePollCtx(api, regularPoll).renderBroadcastPoll([1, 2, 3, 4], [`en`, `en`, `en`, `en`], null, null, null, null, false, 2, 1, null, progress)
    expect(res.successCount).toBe(4)
    expect(progress.mock.calls as Array<Array<number>>).toEqual([[2, 4], [4, 4]])
  })

  it(`paces at the free limit`, async () => {
    const api = makeApi()
    const ids = Array.from({length: 30}, (_, i) => i + 1)
    const langs = Array.from({length: 30}, () => `en`)
    const res = await makePollCtx(api, regularPoll).renderBroadcastPoll(ids, langs)
    expect(res.successCount).toBe(30)
    expect(api.sendPoll).toHaveBeenCalledTimes(30)
  })

  it(`throwError rethrows the aggregated result`, async () => {
    const err = httpError()
    const api = makeApi({
      sendPoll: mock(async () => {
        throw err
      })
    })
    const caught = await makePollCtx(api, regularPoll).renderBroadcastPoll([1], [`en`], null, null, null, null, true).catch((e: unknown) => e)
    expect((caught as {failedCount: number}).failedCount).toBe(1)
    expect((caught as {err: unknown}).err).toBe(err)
  })
})

describe(`live-location`, () => {
  it(`passes live_period through from the template`, async () => {
    const api = makeApi()
    await makeMediaCtx(api, {type: `location`, latitude: `-6.2`, longitude: `106.8`, live: `60`}).renderLocation()
    expect(api.sendLocation).toHaveBeenCalledTimes(1)
    const args = (api.sendLocation.mock.calls as any)[0]
    expect(args[0]).toBe(1)
    expect(args[1]).toBe(-6.2)
    expect(args[2]).toBe(106.8)
    expect(args[3]).toMatchObject({live_period: 60})
  })

  it(`sends a static location without live_period`, async () => {
    const api = makeApi()
    await makeMediaCtx(api, {type: `location`, latitude: `-6.2`, longitude: `106.8`}).renderLocation()
    const args = (api.sendLocation.mock.calls as any)[0]
    expect(args[3]).not.toHaveProperty(`live_period`)
  })

  it(`throws before any api call when live is non-numeric`, async () => {
    const api = makeApi()
    await expect(makeMediaCtx(api, {type: `location`, latitude: `-6.2`, longitude: `106.8`, live: `abc`}).renderLocation()).rejects.toThrow(/live period/)
    expect(api.sendLocation).not.toHaveBeenCalled()
  })

  it(`throws before any api call when live is zero`, async () => {
    const api = makeApi()
    await expect(makeMediaCtx(api, {type: `location`, latitude: `-6.2`, longitude: `106.8`, live: `0`}).renderLocation()).rejects.toThrow(/live period/)
    expect(api.sendLocation).not.toHaveBeenCalled()
  })

  it(`assertLivePeriod accepts numbers and absents`, () => {
    expect(Ctx.assertLivePeriod(undefined)).toBeUndefined()
    expect(Ctx.assertLivePeriod(null)).toBeUndefined()
    expect(Ctx.assertLivePeriod(``)).toBeUndefined()
    expect(Ctx.assertLivePeriod(60)).toBe(60)
    expect(Ctx.assertLivePeriod(`900`)).toBe(900)
    expect(() => Ctx.assertLivePeriod(`1.5`)).toThrow(/live period/)
    expect(() => Ctx.assertLivePeriod(-5)).toThrow(/live period/)
  })

  it(`stopLiveLocation passes chat message and options to the api`, async () => {
    const api = makeApi()
    const ctx = makeMediaCtx(api, {type: `location`, latitude: `0`, longitude: `0`})
    const result = await ctx.stopLiveLocation(7, 9, {business_connection_id: `x`} as never)
    expect(api.stopMessageLiveLocation).toHaveBeenCalledTimes(1)
    expect((api.stopMessageLiveLocation.mock.calls as any)[0]).toEqual([7, 9, {business_connection_id: `x`}])
    expect(result).toBe(true)
  })

  it(`parses and validates the live template attribute`, () => {
    const blocks = TemplateEngine._processGMediaBlocks(`<g-media type="location" latitude="1" longitude="2" live="60">Hi</g-media>`)
    expect(blocks.default!.live).toBe(`60`)
    expect(TemplateEngine.validateBlockGMediaAttributes(`<g-base><g-media type="location" latitude="1" longitude="2" live="60">Hi</g-media></g-base>`).valid).toBe(true)
    const bad = TemplateEngine.validateBlockGMediaAttributes(`<g-base><g-media type="location" latitude="1" longitude="2" live="abc">Hi</g-media></g-base>`)
    expect(bad.valid).toBe(false)
    expect(bad.errors[0]!.message).toContain(`live`)
    const pageBad = TemplateEngine.validatePageAttributeValuesBlock(`<g-base><g-media type="location" latitude="1" longitude="2" live="0">Hi</g-media></g-base>`)
    expect(pageBad.valid).toBe(false)
  })
})

const makeVenueCtx = (api: Record<string, unknown>, venue: ITVenueBlock, extra?: {log?: unknown; onSendError?: unknown}, update: Record<string, unknown> = messageUpdate) => {
  const tm = {getGVenue: mock(() => venue)} as never
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ITCtxParams[`ct`]
  return new ExtraPage({
    ct,
    cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ITCtxParams[`templateManager`],
    log: (extra?.log ?? null) as unknown as ITCtxParams[`log`],
    onSendError: (extra?.onSendError ?? null) as unknown as ITCtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

const makeDiceCtx = (api: Record<string, unknown>, dice: ITDiceBlock, extra?: {log?: unknown; onSendError?: unknown}, update: Record<string, unknown> = messageUpdate) => {
  const tm = {getGDice: mock(() => dice)} as never
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ITCtxParams[`ct`]
  return new ExtraPage({
    ct,
    cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ITCtxParams[`templateManager`],
    log: (extra?.log ?? null) as unknown as ITCtxParams[`log`],
    onSendError: (extra?.onSendError ?? null) as unknown as ITCtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

describe(`venue-render`, () => {
  const venueBlock: ITVenueBlock = {title: `Cafe`, address: `Jl. Merdeka 1`, latitude: `-6.2`, longitude: `106.8`}

  it(`sends a venue from the compiled block with keyboard and options passthrough`, async () => {
    const api = makeApi()
    const kb = {inline_keyboard: []}
    await makeVenueCtx(api, venueBlock).renderVenue(kb as never, {name: `Cafe`}, null, {foursquare_id: `4b0fb0a0f964a520b6f023e3`} as never)
    expect(api.sendVenue).toHaveBeenCalledTimes(1)
    const args = (api.sendVenue.mock.calls as any)[0]
    expect(args.slice(0, 5)).toEqual([1, -6.2, 106.8, `Cafe`, `Jl. Merdeka 1`])
    expect(args[5]).toMatchObject({reply_markup: kb, foursquare_id: `4b0fb0a0f964a520b6f023e3`})
  })

  it(`forwards base id data and language to getGVenue`, async () => {
    const api = makeApi()
    const tm = {getGVenue: mock(() => venueBlock)}
    const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update: {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`, language_code: `id`}}}} as unknown as ITCtxParams[`ct`]
    const ctx = new ExtraPage({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager: tm as unknown as ITCtxParams[`templateManager`],
      log: null as unknown as ITCtxParams[`log`],
      onSendError: null as unknown as ITCtxParams[`onSendError`],
      temp: {isAnswer: false, session: {}, data: {}}
    })
    await ctx.renderVenue(null, {name: `Kafe`}, `promo`)
    expect((tm.getGVenue.mock.calls as any)[0]).toEqual([`extrapage`, `promo`, `id`, {name: `Kafe`}])
  })

  it(`throws before any api call when the compiled title is empty`, async () => {
    const api = makeApi()
    await expect(makeVenueCtx(api, {...venueBlock, title: ``}).renderVenue()).rejects.toThrow(/non-empty "title"/)
    expect(api.sendVenue).not.toHaveBeenCalled()
  })

  it(`throws before any api call when the compiled address is empty`, async () => {
    const api = makeApi()
    await expect(makeVenueCtx(api, {...venueBlock, address: ``}).renderVenue()).rejects.toThrow(/non-empty "address"/)
    expect(api.sendVenue).not.toHaveBeenCalled()
  })

  it(`throws before any api call when compiled coordinates are out of range`, async () => {
    const api = makeApi()
    await expect(makeVenueCtx(api, {...venueBlock, latitude: `999`}).renderVenue()).rejects.toThrow(/latitude/)
    expect(api.sendVenue).not.toHaveBeenCalled()
    await expect(makeVenueCtx(api, {...venueBlock, longitude: `999`}).renderVenue()).rejects.toThrow(/longitude/)
    expect(api.sendVenue).not.toHaveBeenCalled()
  })

  it(`throws when no chat id is available`, async () => {
    const api = makeApi()
    await expect(makeVenueCtx(api, venueBlock, undefined, noChatUpdate).renderVenue()).rejects.toThrow(/Missing information for API call to sendVenue/)
    expect(api.sendVenue).not.toHaveBeenCalled()
  })

  it(`throws before any api call when the block is missing`, async () => {
    const api = makeApi()
    const tm = {getGVenue: mock(() => {
      throw new Error(`Venue function not found for template "extrapage" (base "default", lang "default")`)
    })}
    const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update: messageUpdate} as unknown as ITCtxParams[`ct`]
    const ctx = new ExtraPage({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager: tm as unknown as ITCtxParams[`templateManager`],
      log: null as unknown as ITCtxParams[`log`],
      onSendError: null as unknown as ITCtxParams[`onSendError`],
      temp: {isAnswer: false, session: {}, data: {}}
    })
    await expect(ctx.renderVenue()).rejects.toThrow(/Venue function not found/)
    expect(api.sendVenue).not.toHaveBeenCalled()
  })

  it(`notifies fallback-text with page kind chatId and rethrows the original 403 error`, async () => {
    const err = grammyError(403)
    const seen: Array<{err: unknown; info: unknown}> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendVenue: mock(async () => {
        throw err
      })
    })
    await expect(
      makeVenueCtx(api, venueBlock, {log: {warn, error}, onSendError: (e: unknown, info: unknown) => {
        seen.push({err: e, info})
      }}).renderVenue()
    ).rejects.toBe(err)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `extrapage`, kind: `fallback-text`, chatId: 1})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })

  it(`notifies retryable with error log and rethrows the original transport error`, async () => {
    const err = httpError()
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendVenue: mock(async () => {
        throw err
      })
    })
    await expect(
      makeVenueCtx(api, venueBlock, {log: {warn, error}, onSendError: (_e: unknown, info: unknown) => {
        seen.push(info)
      }}).renderVenue()
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `extrapage`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe(`dice-render`, () => {
  it(`sends the compiled emoji with keyboard and options passthrough`, async () => {
    const api = makeApi()
    const kb = {inline_keyboard: []}
    await makeDiceCtx(api, {emoji: `🎯`}).renderDice(kb as never, {dice: `🎯`}, null, {disable_notification: true} as never)
    expect(api.sendDice).toHaveBeenCalledTimes(1)
    const args = (api.sendDice.mock.calls as any)[0]
    expect(args[0]).toBe(1)
    expect(args[1]).toBe(`🎯`)
    expect(args[2]).toMatchObject({reply_markup: kb, disable_notification: true})
  })

  it(`sends the default emoji block without interpolation data`, async () => {
    const api = makeApi()
    await makeDiceCtx(api, {emoji: `🎲`}).renderDice()
    const args = (api.sendDice.mock.calls as any)[0]
    expect(args[0]).toBe(1)
    expect(args[1]).toBe(`🎲`)
    expect(args[2]).toMatchObject({})
  })

  it(`forwards base id data and language to getGDice`, async () => {
    const api = makeApi()
    const tm = {getGDice: mock(() => ({emoji: `🏀`}))}
    const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update: {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`, language_code: `id`}}}} as unknown as ITCtxParams[`ct`]
    const ctx = new ExtraPage({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager: tm as unknown as ITCtxParams[`templateManager`],
      log: null as unknown as ITCtxParams[`log`],
      onSendError: null as unknown as ITCtxParams[`onSendError`],
      temp: {isAnswer: false, session: {}, data: {}}
    })
    await ctx.renderDice(null, {dice: `🏀`}, `lucky`)
    expect((tm.getGDice.mock.calls as any)[0]).toEqual([`extrapage`, `lucky`, `id`, {dice: `🏀`}])
    expect((api.sendDice.mock.calls as any)[0][1]).toBe(`🏀`)
  })

  it(`throws before any api call when the compiled emoji is invalid`, async () => {
    const api = makeApi()
    await expect(makeDiceCtx(api, {emoji: `❌`}).renderDice()).rejects.toThrow(/dice emoji/)
    expect(api.sendDice).not.toHaveBeenCalled()
  })

  it(`throws when no chat id is available`, async () => {
    const api = makeApi()
    await expect(makeDiceCtx(api, {emoji: `🎲`}, undefined, noChatUpdate).renderDice()).rejects.toThrow(/Missing information for API call to sendDice/)
    expect(api.sendDice).not.toHaveBeenCalled()
  })

  it(`throws before any api call when the block is missing`, async () => {
    const api = makeApi()
    const tm = {getGDice: mock(() => {
      throw new Error(`Dice function not found for template "extrapage" (base "default", lang "default")`)
    })}
    const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update: messageUpdate} as unknown as ITCtxParams[`ct`]
    const ctx = new ExtraPage({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager: tm as unknown as ITCtxParams[`templateManager`],
      log: null as unknown as ITCtxParams[`log`],
      onSendError: null as unknown as ITCtxParams[`onSendError`],
      temp: {isAnswer: false, session: {}, data: {}}
    })
    await expect(ctx.renderDice()).rejects.toThrow(/Dice function not found/)
    expect(api.sendDice).not.toHaveBeenCalled()
  })

  it(`notifies fallback-text with page kind chatId and rethrows the original 403 error`, async () => {
    const err = grammyError(403)
    const seen: Array<{err: unknown; info: unknown}> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendDice: mock(async () => {
        throw err
      })
    })
    await expect(
      makeDiceCtx(api, {emoji: `🎰`}, {log: {warn, error}, onSendError: (e: unknown, info: unknown) => {
        seen.push({err: e, info})
      }}).renderDice()
    ).rejects.toBe(err)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `extrapage`, kind: `fallback-text`, chatId: 1})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })

  it(`notifies retryable with error log and rethrows the original transport error`, async () => {
    const err = httpError()
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendDice: mock(async () => {
        throw err
      })
    })
    await expect(
      makeDiceCtx(api, {emoji: `🎲`}, {log: {warn, error}, onSendError: (_e: unknown, info: unknown) => {
        seen.push(info)
      }}).renderDice()
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `extrapage`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe(`assert-direct-pins`, () => {
  it(`assertDiceEmoji pins every Bot API emoji directly`, () => {
    for (const emoji of [`🎲`, `🎯`, `🏀`, `⚽`, `🎳`, `🎰`]) expect(Ctx.assertDiceEmoji(emoji)).toBe(emoji)
    expect(() => Ctx.assertDiceEmoji(`❌`)).toThrow(/must be one of 🎲🎯🏀⚽🎳🎰/)
    expect(() => Ctx.assertDiceEmoji(``)).toThrow(/must be one of/)
    expect(() => Ctx.assertDiceEmoji(42)).toThrow(/must be one of/)
    expect(() => Ctx.assertDiceEmoji(undefined)).toThrow(/must be one of/)
  })

  it(`assertVenue pins the compiled block directly`, () => {
    expect(Ctx.assertVenue({title: `Cafe`, address: `Jl. Merdeka 1`, latitude: `-6.2`, longitude: `106.8`})).toEqual({title: `Cafe`, address: `Jl. Merdeka 1`, latitude: -6.2, longitude: 106.8})
    expect(() => Ctx.assertVenue({title: ``, address: `Jl. Merdeka 1`, latitude: `0`, longitude: `0`})).toThrow(/non-empty "title"/)
    expect(() => Ctx.assertVenue({title: `Cafe`, address: `  `, latitude: `0`, longitude: `0`})).toThrow(/non-empty "address"/)
    expect(() => Ctx.assertVenue({title: `Cafe`, address: `Jl. Merdeka 1`, latitude: `999`, longitude: `0`})).toThrow(/latitude/)
    expect(() => Ctx.assertVenue({title: `Cafe`, address: `Jl. Merdeka 1`, latitude: `0`, longitude: `999`})).toThrow(/longitude/)
  })
})
