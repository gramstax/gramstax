import {describe, expect, it, mock} from "bun:test"
import {readFileSync} from "node:fs"
import {InputFile} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"
import type {IPollBlock} from "~/types/template"

class DedupPage extends Ctx {
  static data = Ctx.buildData({name: `deduppage`})
}

const regularPoll: IPollBlock = {type: `regular`, question: `Pick one?`, options: [`Alpha`, `Beta`], anonymous: true}

const makeApi = (overrides?: Record<string, unknown>) => ({
  config: {use: () => {}},
  sendPoll: mock(async () => ({message_id: 7}) as never),
  refundStarPayment: mock(async () => true as never),
  postStory: mock(async () => ({id: 21}) as never),
  ...(overrides ?? {})
})

const messageUpdate = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

const makeCtx = (api: Record<string, unknown>, poll: IPollBlock = regularPoll) => {
  const tm = {getGPoll: mock(() => poll)} as never
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update: messageUpdate} as unknown as ICtxParams[`ct`]
  return new DedupPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ICtxParams[`templateManager`],
    log: null as unknown as ICtxParams[`log`],
    onSendError: null as unknown as ICtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

describe(`dedup-invariants`, () => {
  it(`kept wrappers carry capability the grammy base lacks (explicit ids, local-path upload)`, async () => {
    const api = makeApi()
    const ctx = makeCtx(api)
    const refunded = await ctx.refundStars(123, `ch_1`)
    expect(refunded).toBe(true)
    expect((api.refundStarPayment.mock.calls as any)[0]).toEqual([123, `ch_1`])
    await ctx.postBusinessStory(`conn-1`, {type: `photo`, src: Buffer.from(`bytes`)}, 43200)
    expect(api.postStory).toHaveBeenCalledTimes(1)
    const storyArgs = (api.postStory.mock.calls as any)[0]
    expect(storyArgs[0]).toBe(`conn-1`)
    expect(storyArgs[1].photo instanceof InputFile).toBe(true)
    expect(storyArgs[2]).toBe(43200)
  })

  it(`single-sends delegate to replyWith* with no explicit chatId arg`, async () => {
    const api = makeApi()
    const ctx = makeCtx(api)
    const replySpy = mock(async () => ({message_id: 1}) as never)
    ;(ctx as unknown as {replyWithPoll: unknown}).replyWithPoll = replySpy
    await ctx.renderPoll()
    expect(replySpy).toHaveBeenCalledTimes(1)
    const replyArgs = (replySpy.mock.calls as any)[0]
    expect(replyArgs[0]).toBe(`Pick one?`)
    expect(replyArgs[1]).toEqual([`Alpha`, `Beta`])
    expect(api.sendPoll).not.toHaveBeenCalled()
  })

  it(`successful single-sends never consult sendChatId for routing`, async () => {
    const api = makeApi()
    const ctx = makeCtx(api)
    const sendChatIdSpy = mock(() => 1)
    ctx.sendChatId = sendChatIdSpy
    await ctx.renderPoll()
    expect(api.sendPoll).toHaveBeenCalledTimes(1)
    expect(sendChatIdSpy).not.toHaveBeenCalled()
  })

  it(`ctx.ts contains zero void-param silencers`, () => {
    const src = readFileSync(new URL(`../src/core/ctx.ts`, import.meta.url), `utf8`)
    const silencers = src.split(`\n`).filter((line) => /^\s*void [A-Za-z]+$/.test(line))
    expect(silencers).toEqual([])
  })
})
