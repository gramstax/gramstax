import {describe, expect, it, mock} from "bun:test"
import {GrammyError, HttpError, InputFile} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

class GiveawayStoryPage extends Ctx {
  static data = Ctx.buildData({name: `giveawaystory`})
}

const grammyError = (code: number) => new GrammyError(`Call failed!`, {error_code: code, description: `desc`, parameters: {}} as never, `postStory`, {})

const httpError = () => new HttpError(`net down`, new Error(`socket`))

const future = () => Math.floor(Date.now() / 1000) + 3600

const messageUpdate = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

const makeApi = (overrides?: Record<string, unknown>) => ({
  config: {use: () => {}},
  raw: {sendGiveaway: mock(async () => ({message_id: 11}) as never)},
  postStory: mock(async () => ({story: {id: 21}}) as never),
  editStory: mock(async () => ({story: {id: 22}}) as never),
  deleteStory: mock(async () => true as never),
  ...(overrides ?? {})
})

const makeCtx = (api: Record<string, unknown>, extra?: {log?: unknown; onSendError?: unknown}) => {
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update: messageUpdate} as unknown as ICtxParams[`ct`]
  return new GiveawayStoryPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {} as unknown as ICtxParams[`templateManager`],
    log: (extra?.log ?? null) as unknown as ICtxParams[`log`],
    onSendError: (extra?.onSendError ?? null) as unknown as ICtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

const giveawayParams = () => ({channels: [-100111222333, `@durov`] as Array<number | string>, date: future(), winners: 2, prize: `iPhone 16`})

describe(`giveaway-start`, () => {
  it(`sends a giveaway through raw with mapped fields and flag options`, async () => {
    const api = makeApi()
    const date = future()
    const res = await makeCtx(api).startGiveaway({channels: [-100111222333, `@durov`], date, winners: 2, prize: `iPhone 16`}, {onlyNewMembers: true, hasPublicWinners: false})
    expect(res).toEqual({message_id: 11})
    expect(api.raw.sendGiveaway).toHaveBeenCalledTimes(1)
    const args = (api.raw.sendGiveaway.mock.calls as any)[0][0]
    expect(args).toMatchObject({chat_id: -100111222333, chats: [-100111222333, `@durov`], winners_selection_date: date, winner_count: 2, prize_description: `iPhone 16`, only_new_members: true, has_public_winners: false})
    expect(args).not.toHaveProperty(`prize_star_count`)
  })

  it(`accepts comma-separated channels with numeric coercion and star options`, async () => {
    const api = makeApi()
    await makeCtx(api).startGiveaway({channels: `@a,-100999`, date: future(), winners: 1, prize: `Stars`}, {prizeStarCount: 50, premiumMonths: 6})
    const args = (api.raw.sendGiveaway.mock.calls as any)[0][0]
    expect(args.chat_id).toBe(`@a`)
    expect(args.chats).toEqual([`@a`, -100999])
    expect(args).toMatchObject({prize_star_count: 50, premium_subscription_month_count: 6})
  })

  it(`throws before any api call when params are missing`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).startGiveaway(null)).rejects.toThrow(/giveaway params/)
    expect(api.raw.sendGiveaway).not.toHaveBeenCalled()
  })

  it(`throws before any api call when channels are not an array or string`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).startGiveaway({...giveawayParams(), channels: 42 as any})).rejects.toThrow(/as chat ids/)
    expect(api.raw.sendGiveaway).not.toHaveBeenCalled()
  })

  it(`throws before any api call when a channel entry is empty`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).startGiveaway({...giveawayParams(), channels: [`@ok`, ``]})).rejects.toThrow(/at least 1 chat id/)
    expect(api.raw.sendGiveaway).not.toHaveBeenCalled()
  })

  it(`throws before any api call when channels are empty`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).startGiveaway({...giveawayParams(), channels: []})).rejects.toThrow(/at least 1 chat id/)
    expect(api.raw.sendGiveaway).not.toHaveBeenCalled()
  })

  it(`throws before any api call when the date is in the past`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).startGiveaway({...giveawayParams(), date: 1})).rejects.toThrow(/future/)
    expect(api.raw.sendGiveaway).not.toHaveBeenCalled()
  })

  it(`throws before any api call when winners is not positive`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).startGiveaway({...giveawayParams(), winners: 0})).rejects.toThrow(/positive integer/)
    expect(api.raw.sendGiveaway).not.toHaveBeenCalled()
  })

  it(`throws before any api call when the prize is empty`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).startGiveaway({...giveawayParams(), prize: `   `})).rejects.toThrow(/non-empty prize/)
    expect(api.raw.sendGiveaway).not.toHaveBeenCalled()
  })

  it(`notifies fallback-text with page kind chatId and rethrows the original 403 error`, async () => {
    const err = grammyError(403)
    const seen: Array<{err: unknown; info: unknown}> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      raw: {
        sendGiveaway: mock(async () => {
          throw err
        })
      }
    })
    await expect(
      makeCtx(api, {
        log: {warn, error},
        onSendError: (e: unknown, info: unknown) => {
          seen.push({err: e, info})
        }
      }).startGiveaway(giveawayParams())
    ).rejects.toBe(err)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `giveawaystory`, kind: `fallback-text`, chatId: 1})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })

  it(`notifies retryable with error log and rethrows the original transport error`, async () => {
    const err = httpError()
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      raw: {
        sendGiveaway: mock(async () => {
          throw err
        })
      }
    })
    await expect(
      makeCtx(api, {
        log: {warn, error},
        onSendError: (_e: unknown, info: unknown) => {
          seen.push(info)
        }
      }).startGiveaway(giveawayParams())
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `giveawaystory`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe(`business-story-post`, () => {
  it(`posts a photo story from a url with options passthrough (business-connection-only API)`, async () => {
    const api = makeApi()
    const res = (await makeCtx(api).postBusinessStory(`conn-1`, {type: `photo`, src: `https://example.com/pic.jpg`}, 86400, {caption: `hi`})) as unknown
    expect(res).toEqual({story: {id: 21}})
    expect(api.postStory).toHaveBeenCalledTimes(1)
    const args = (api.postStory.mock.calls as any)[0]
    expect(args[0]).toBe(`conn-1`)
    expect(args[1]).toMatchObject({type: `photo`})
    expect((args[1] as {photo: unknown}).photo).toBeInstanceOf(InputFile)
    expect(args[2]).toBe(86400)
    expect(args[3]).toMatchObject({caption: `hi`})
  })

  it(`posts a video story with duration`, async () => {
    const api = makeApi()
    await makeCtx(api).postBusinessStory(`conn-1`, {type: `video`, src: `https://example.com/clip.mp4`, duration: 30}, 21600)
    const args = (api.postStory.mock.calls as any)[0]
    expect(args[1]).toMatchObject({type: `video`, duration: 30})
    expect((args[1] as {video: unknown}).video).toBeInstanceOf(InputFile)
  })

  it(`uploads buffer src as InputFile`, async () => {
    const api = makeApi()
    await makeCtx(api).postBusinessStory(`conn-1`, {type: `photo`, src: Buffer.from(`bytes`)}, 43200)
    const args = (api.postStory.mock.calls as any)[0]
    expect((args[1] as {photo: unknown}).photo).toBeInstanceOf(InputFile)
  })

  it(`passes file_id src through as a string`, async () => {
    const api = makeApi()
    await makeCtx(api).postBusinessStory(`conn-1`, {type: `photo`, src: `AgAC123`}, 172800)
    const args = (api.postStory.mock.calls as any)[0]
    expect(args[1]).toMatchObject({type: `photo`, photo: `AgAC123`})
  })

  it(`throws before any api call when the business connection id is missing (business-connection-only prerequisite)`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).postBusinessStory(``, {type: `photo`, src: `AgAC123`}, 86400)).rejects.toThrow(/business connection id/)
    expect(api.postStory).not.toHaveBeenCalled()
  })

  it(`throws before any api call when content is missing`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).postBusinessStory(`conn-1`, null, 86400)).rejects.toThrow(/requires story content/)
    expect(api.postStory).not.toHaveBeenCalled()
  })

  it(`throws before any api call when content type is not photo or video`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).postBusinessStory(`conn-1`, {type: `gif`, src: `x`} as any, 86400)).rejects.toThrow(/"photo" or "video"/)
    expect(api.postStory).not.toHaveBeenCalled()
  })

  it(`throws before any api call when src is empty`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).postBusinessStory(`conn-1`, {type: `photo`, src: ``}, 86400)).rejects.toThrow(/content src/)
    expect(api.postStory).not.toHaveBeenCalled()
  })

  it(`throws before any api call when activePeriod is not an allowed value`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).postBusinessStory(`conn-1`, {type: `photo`, src: `AgAC123`}, 100)).rejects.toThrow(/activePeriod/)
    expect(api.postStory).not.toHaveBeenCalled()
  })

  it(`notifies fallback-text with page kind chatId and rethrows the original 403 error`, async () => {
    const err = grammyError(403)
    const seen: Array<{err: unknown; info: unknown}> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      postStory: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, {
        log: {warn, error},
        onSendError: (e: unknown, info: unknown) => {
          seen.push({err: e, info})
        }
      }).postBusinessStory(`conn-1`, {type: `photo`, src: `AgAC123`}, 86400)
    ).rejects.toBe(err)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `giveawaystory`, kind: `fallback-text`, chatId: 1})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })

  it(`notifies retryable with error log and rethrows the original transport error`, async () => {
    const err = httpError()
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      postStory: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, {
        log: {warn, error},
        onSendError: (_e: unknown, info: unknown) => {
          seen.push(info)
        }
      }).postBusinessStory(`conn-1`, {type: `photo`, src: `AgAC123`}, 86400)
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `giveawaystory`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe(`business-story-edit`, () => {
  it(`edits a story with resolved content (business-connection-only API)`, async () => {
    const api = makeApi()
    const res = (await makeCtx(api).editBusinessStory(`conn-1`, 21, {type: `photo`, src: `AgAC9`})) as unknown
    expect(res).toEqual({story: {id: 22}})
    expect(api.editStory).toHaveBeenCalledTimes(1)
    const args = (api.editStory.mock.calls as any)[0]
    expect(args.slice(0, 2)).toEqual([`conn-1`, 21])
    expect(args[2]).toMatchObject({type: `photo`, photo: `AgAC9`})
    expect(args[3]).toEqual({})
  })

  it(`throws before any api call when the business connection id is missing (business-connection-only prerequisite)`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).editBusinessStory(null, 21, {type: `photo`, src: `AgAC9`})).rejects.toThrow(/business connection id/)
    expect(api.editStory).not.toHaveBeenCalled()
  })

  it(`throws before any api call when the story id is not a positive integer`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).editBusinessStory(`conn-1`, 0, {type: `photo`, src: `AgAC9`})).rejects.toThrow(/positive integer/)
    expect(api.editStory).not.toHaveBeenCalled()
  })

  it(`throws before any api call when content is missing`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).editBusinessStory(`conn-1`, 21, null)).rejects.toThrow(/requires story content/)
    expect(api.editStory).not.toHaveBeenCalled()
  })

  it(`throws before any api call when content type is not photo or video`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).editBusinessStory(`conn-1`, 21, {type: `gif`, src: `x`} as any)).rejects.toThrow(/"photo" or "video"/)
    expect(api.editStory).not.toHaveBeenCalled()
  })

  it(`throws before any api call when src is empty`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).editBusinessStory(`conn-1`, 21, {type: `video`, src: ``})).rejects.toThrow(/content src/)
    expect(api.editStory).not.toHaveBeenCalled()
  })

  it(`notifies fallback-text with page kind chatId and rethrows the original 403 error`, async () => {
    const err = grammyError(403)
    const seen: Array<{err: unknown; info: unknown}> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      editStory: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, {
        log: {warn, error},
        onSendError: (e: unknown, info: unknown) => {
          seen.push({err: e, info})
        }
      }).editBusinessStory(`conn-1`, 21, {type: `photo`, src: `AgAC9`})
    ).rejects.toBe(err)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `giveawaystory`, kind: `fallback-text`, chatId: 1})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })

  it(`notifies retryable with error log and rethrows the original transport error`, async () => {
    const err = httpError()
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      editStory: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, {
        log: {warn, error},
        onSendError: (_e: unknown, info: unknown) => {
          seen.push(info)
        }
      }).editBusinessStory(`conn-1`, 21, {type: `photo`, src: `AgAC9`})
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `giveawaystory`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe(`business-story-delete`, () => {
  it(`deletes a story with connection and story id (business-connection-only API)`, async () => {
    const api = makeApi()
    const res = await makeCtx(api).deleteBusinessStory(`conn-1`, 21)
    expect(res).toBe(true)
    expect(api.deleteStory).toHaveBeenCalledTimes(1)
    expect((api.deleteStory.mock.calls as any)[0]).toEqual([`conn-1`, 21])
  })

  it(`throws before any api call when the business connection id is missing (business-connection-only prerequisite)`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).deleteBusinessStory(``, 21)).rejects.toThrow(/business connection id/)
    expect(api.deleteStory).not.toHaveBeenCalled()
  })

  it(`throws before any api call when the story id is not a positive integer`, async () => {
    const api = makeApi()
    await expect(makeCtx(api).deleteBusinessStory(`conn-1`, -3)).rejects.toThrow(/positive integer/)
    expect(api.deleteStory).not.toHaveBeenCalled()
  })

  it(`notifies fallback-text with page kind chatId and rethrows the original 403 error`, async () => {
    const err = grammyError(403)
    const seen: Array<{err: unknown; info: unknown}> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      deleteStory: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, {
        log: {warn, error},
        onSendError: (e: unknown, info: unknown) => {
          seen.push({err: e, info})
        }
      }).deleteBusinessStory(`conn-1`, 21)
    ).rejects.toBe(err)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `giveawaystory`, kind: `fallback-text`, chatId: 1})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })

  it(`notifies retryable with error log and rethrows the original transport error`, async () => {
    const err = httpError()
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      deleteStory: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, {
        log: {warn, error},
        onSendError: (_e: unknown, info: unknown) => {
          seen.push(info)
        }
      }).deleteBusinessStory(`conn-1`, 21)
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `giveawaystory`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe(`stars-transactions`, () => {
  it(`passes options through to api.getStarTransactions`, async () => {
    const api = makeApi({getStarTransactions: mock(async () => ({transactions: []}) as never)})
    const res = await makeCtx(api).getStarTransactions({limit: 100})
    expect(res).toEqual({transactions: []})
    const calls = (api as any).getStarTransactions.mock.calls as any
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toEqual({limit: 100})
  })

  it(`calls without options`, async () => {
    const api = makeApi({getStarTransactions: mock(async () => ({transactions: []}) as never)})
    await makeCtx(api).getStarTransactions()
    expect((api as any).getStarTransactions.mock.calls as any).toHaveLength(1)
  })
})
