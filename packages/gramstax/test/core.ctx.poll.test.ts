import {describe, expect, it, mock} from "bun:test"
import {GrammyError, HttpError} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"
import type {IPollBlock} from "~/types/template"

class PollPage extends Ctx {
  static data = Ctx.buildData({name: `pollpage`})
}

const grammyError = (code: number) => new GrammyError(`Call failed!`, {error_code: code, description: `desc`, parameters: {}} as never, `sendPoll`, {})

const httpError = () => new HttpError(`net down`, new Error(`socket`))

const regularPoll: IPollBlock = {type: `regular`, question: `Pick one?`, options: [`Alpha`, `Beta`], anonymous: true}

const quizPoll: IPollBlock = {type: `quiz`, question: `What is 2+2?`, options: [`3`, `4`], correct: 1, explanation: `Arithmetic`, anonymous: true}

const makeApi = (overrides?: Record<string, unknown>) => ({
  config: {use: () => {}},
  sendPoll: mock(async () => ({message_id: 7}) as never),
  stopPoll: mock(async () => ({question: `Q?`}) as never),
  ...(overrides ?? {})
})

const messageUpdate = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

const noChatUpdate = {message: {message_id: 1, date: 1, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

const makeCtx = (api: Record<string, unknown>, poll: IPollBlock, extra?: {log?: unknown; onSendError?: unknown}, update: Record<string, unknown> = messageUpdate) => {
  const tm = {getGPoll: mock(() => poll)} as never
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ICtxParams[`ct`]
  return new PollPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ICtxParams[`templateManager`],
    log: (extra?.log ?? null) as unknown as ICtxParams[`log`],
    onSendError: (extra?.onSendError ?? null) as unknown as ICtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

describe(`poll-render`, () => {
  it(`sends a regular poll with parse mode and anonymity`, async () => {
    const api = makeApi()
    const kb = {inline_keyboard: []}
    await makeCtx(api, regularPoll).renderPoll(kb as never, {topic: `x`})
    expect(api.sendPoll).toHaveBeenCalledTimes(1)
    const args = (api.sendPoll.mock.calls as any)[0]
    expect(args[0]).toBe(1)
    expect(args[1]).toBe(`Pick one?`)
    expect(args[2]).toEqual([`Alpha`, `Beta`])
    expect(args[3]).toMatchObject({question_parse_mode: `HTML`, type: `regular`, is_anonymous: true, reply_markup: kb})
  })

  it(`sends a quiz poll with grading fields`, async () => {
    const api = makeApi()
    await makeCtx(api, quizPoll).renderPoll()
    const args = (api.sendPoll.mock.calls as any)[0]
    expect(args[3]).toMatchObject({type: `quiz`, correct_option_id: 1, explanation: `Arithmetic`, explanation_parse_mode: `HTML`})
  })

  it(`forwards allows_multiple_answers for regular polls`, async () => {
    const api = makeApi()
    await makeCtx(api, {...regularPoll, multiple: true}).renderPoll()
    const args = (api.sendPoll.mock.calls as any)[0]
    expect(args[3]).toMatchObject({allows_multiple_answers: true})
  })

  it(`throws before any api call when the question overflows`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...regularPoll, question: `Q`.repeat(301)}).renderPoll()).rejects.toThrow(/1-300/)
    expect(api.sendPoll).not.toHaveBeenCalled()
  })

  it(`throws before any api call when an option overflows`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...regularPoll, options: [`A`, `O`.repeat(101)]}).renderPoll()).rejects.toThrow(/1-100/)
    expect(api.sendPoll).not.toHaveBeenCalled()
  })

  it(`throws before any api call when options fall below two`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...regularPoll, options: [`Solo`]}).renderPoll()).rejects.toThrow(/2-10/)
    expect(api.sendPoll).not.toHaveBeenCalled()
  })

  it(`throws before any api call when correct is out of range`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...quizPoll, correct: 9}).renderPoll()).rejects.toThrow(/option index 0-1/)
    expect(api.sendPoll).not.toHaveBeenCalled()
  })

  it(`throws before any api call when the explanation overflows`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...quizPoll, explanation: `E`.repeat(201)}).renderPoll()).rejects.toThrow(/at most 200/)
    expect(api.sendPoll).not.toHaveBeenCalled()
  })

  it(`throws when no chat id is available`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, regularPoll, undefined, noChatUpdate).renderPoll()).rejects.toThrow(/Missing information for API call to sendPoll/)
    expect(api.sendPoll).not.toHaveBeenCalled()
  })

  it(`notifies fallback-text with page kind chatId and rethrows the original 403 error`, async () => {
    const err = grammyError(403)
    const seen: Array<{err: unknown; info: unknown}> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendPoll: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, regularPoll, {
        log: {warn, error},
        onSendError: (e: unknown, info: unknown) => {
          seen.push({err: e, info})
        }
      }).renderPoll()
    ).rejects.toBe(err)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `pollpage`, kind: `fallback-text`, chatId: 1})
    expect(warn).toHaveBeenCalledTimes(1)
    expect((warn.mock.calls as any)[0][0]).toContain(`pollpage`)
    expect(error).not.toHaveBeenCalled()
  })

  it(`notifies retryable with error log and rethrows the original transport error`, async () => {
    const err = httpError()
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendPoll: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, regularPoll, {
        log: {warn, error},
        onSendError: (_e: unknown, info: unknown) => {
          seen.push(info)
        }
      }).renderPoll()
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `pollpage`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
    const msg = (error.mock.calls as any)[0][0] as string
    expect(msg).toContain(`pollpage`)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe(`poll-stop`, () => {
  it(`passes chat message and options to api stopPoll`, async () => {
    const api = makeApi()
    const ctx = makeCtx(api, regularPoll)
    const result = await ctx.stopPoll(7, 9, {business_connection_id: `x`} as never)
    expect(api.stopPoll).toHaveBeenCalledTimes(1)
    expect((api.stopPoll.mock.calls as any)[0]).toEqual([7, 9, {business_connection_id: `x`}])
    expect(result).toEqual(expect.objectContaining({question: `Q?`}))
  })

  it(`delegates the inherited form to the base context`, async () => {
    const api = makeApi()
    const ctx = makeCtx(api, regularPoll)
    await ctx.stopPoll()
    expect(api.stopPoll).toHaveBeenCalledTimes(1)
  })
})
