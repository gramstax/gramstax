import {describe, expect, it, mock} from "bun:test"
import {GrammyError} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ITCtxParams} from "~/types/t.ctx"

// ── Test page class ──────────────────────────────────────────────────

class InlineAnswerPage extends Ctx {
  static data = this.buildData({name: `inline-answer-test`})
}

// ── Helpers ──────────────────────────────────────────────────────────

const from = {id: 1, is_bot: false, first_name: `A`}

const inlineUpdate = {inline_query: {id: `iq1`, from, query: `x`, offset: ``}}
const guestUpdate = {guest_message: {guest_query_id: `gq1`, from}}
const messageUpdate = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from}}

const article = {type: `article`, id: `r1`, title: `T`, input_message_content: {message_text: `hi`}}

function createCtx(api: Record<string, unknown>, update: unknown, text = `hello`, onSendError: unknown = null, button: unknown = {text}) {
  const ct = {
    api,
    me: {id: 9, is_bot: true, first_name: `Bot`} as any,
    update: update as any
  } as unknown as ITCtxParams[`ct`]
  return new InlineAnswerPage({
    ct,
    cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {getGInlineButton: () => button, getGAnswerNote: () => text, getGKeyboard: () => []} as unknown as ITCtxParams[`templateManager`],
    onSendError: onSendError as unknown as ITCtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

function makeApi() {
  return {
    config: {use: () => {}},
    answerInlineQuery: mock(async () => true as any),
    answerGuestQuery: mock(async () => ({}) as any),
    answerWebAppQuery: mock(async () => ({}) as any)
  }
}

// ── renderInlineAnswer ───────────────────────────────────────────────

describe(`Ctx.renderInlineAnswer`, () => {
  it(`passes caller results with the query id and no button by default`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, inlineUpdate, `unused`)
    await ctx.renderInlineAnswer([article] as any, undefined, `inline-card`)
    expect(api.answerInlineQuery).toHaveBeenCalledTimes(1)
    const [id, results, extra] = (api.answerInlineQuery.mock.calls as any[])[0] as [string, unknown[], Record<string, unknown>]
    expect(id).toBe(`iq1`)
    expect(results).toEqual([article])
    expect(extra?.button).toBeUndefined()
  })

  it(`builds button text from the block when a start parameter is given`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, inlineUpdate, `Lihat detail`)
    await ctx.renderInlineAnswer([article] as any, undefined, `inline-card`, undefined, `start=1`)
    const [, , extra] = (api.answerInlineQuery.mock.calls as any[])[0] as [string, unknown[], Record<string, unknown>]
    expect(extra.button).toEqual({text: `Lihat detail`, start_parameter: `start=1`})
  })

  it(`uses the block start-parameter when the caller supplies none`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, inlineUpdate, `Label`, null, {text: `Label`, startParameter: `block-9`})
    await ctx.renderInlineAnswer([article] as any, undefined, `inline-card`)
    const [, , extra] = (api.answerInlineQuery.mock.calls as any[])[0] as [string, unknown[], Record<string, unknown>]
    expect(extra.button).toEqual({text: `Label`, start_parameter: `block-9`})
  })

  it(`preserves a caller-supplied button over the block`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, inlineUpdate, `block text`)
    await ctx.renderInlineAnswer([article] as any, undefined, `inline-card`, {button: {text: `Mine`, start_parameter: `s`}} as any, `start=1`)
    const [, , extra] = (api.answerInlineQuery.mock.calls as any[])[0] as [string, unknown[], Record<string, unknown>]
    expect(extra.button).toEqual({text: `Mine`, start_parameter: `s`})
  })

  it(`rethrows after notify on send failure`, async () => {
    const err = new GrammyError(`Bad Request: query is too old`, {error_code: 400, description: `Bad Request: query is too old`, parameters: {}} as never, `answerInlineQuery`, {})
    const api = makeApi()
    api.answerInlineQuery = mock(async () => {
      throw err
    })
    const seen: unknown[] = []
    const ctx = createCtx(api, inlineUpdate, `x`, (e: unknown) => seen.push(e))
    await expect(ctx.renderInlineAnswer([article] as any, undefined, `inline-card`)).rejects.toThrow(err)
    expect(seen.length).toBe(1)
  })
})

// ── renderGuestAnswer ────────────────────────────────────────────────

describe(`Ctx.renderGuestAnswer`, () => {
  it(`passes the result through with the guest query id`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, guestUpdate, `unused`)
    await ctx.renderGuestAnswer(article as any, undefined, `guest-card`)
    expect(api.answerGuestQuery).toHaveBeenCalledTimes(1)
    const [id, result] = (api.answerGuestQuery.mock.calls as any[])[0] as [string, unknown]
    expect(id).toBe(`gq1`)
    expect(result).toEqual(article)
  })

  it(`rethrows after notify on send failure`, async () => {
    const err = new GrammyError(`Bad Request: query is too old`, {error_code: 400, description: `Bad Request: query is too old`, parameters: {}} as never, `answerGuestQuery`, {})
    const api = makeApi()
    api.answerGuestQuery = mock(async () => {
      throw err
    })
    const seen: unknown[] = []
    const ctx = createCtx(api, guestUpdate, `x`, (e: unknown) => seen.push(e))
    await expect(ctx.renderGuestAnswer(article as any, undefined, `guest-card`)).rejects.toThrow(err)
    expect(seen.length).toBe(1)
  })
})

// ── renderWebAppAnswer ───────────────────────────────────────────────

describe(`Ctx.renderWebAppAnswer`, () => {
  it(`calls api.answerWebAppQuery with the explicit id and result`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, messageUpdate, `unused`)
    await ctx.renderWebAppAnswer(`wq1`, article as any, undefined, `webapp-card`)
    expect(api.answerWebAppQuery).toHaveBeenCalledTimes(1)
    const [id, result] = (api.answerWebAppQuery.mock.calls as any[])[0] as [string, unknown]
    expect(id).toBe(`wq1`)
    expect(result).toEqual(article)
  })

  it(`rethrows after notify on send failure`, async () => {
    const err = new GrammyError(`Bad Request: query is too old`, {error_code: 400, description: `Bad Request: query is too old`, parameters: {}} as never, `answerWebAppQuery`, {})
    const api = makeApi()
    api.answerWebAppQuery = mock(async () => {
      throw err
    })
    const seen: unknown[] = []
    const ctx = createCtx(api, messageUpdate, `x`, (e: unknown) => seen.push(e))
    await expect(ctx.renderWebAppAnswer(`wq1`, article as any, undefined, `webapp-card`)).rejects.toThrow(err)
    expect(seen.length).toBe(1)
  })
})
