import {describe, it, expect, mock} from "bun:test"
import {Ctx} from "~/core/ctx"
import type {ITCtxParams} from "~/types/t.ctx"

/**
 * Mock API that simulates grammY's per-request Api + transformer chain.
 * Stores transformers installed via `config.use()` and invokes them
 * before delegating to the underlying mock implementation.
 */
function createMockApi() {
  const sendMessage = mock(() => ({message_id: 1, date: 0, chat: {id: 1, type: `private` as const}} as any))
  const answerCallbackQuery = mock(() => true as any)
  const editMessageText = mock(() => true as any)
  const deleteMessage = mock(() => true as any)
  const getMe = mock(() => ({id: 1, is_bot: true, first_name: `Bot`} as any))

  type TransformerFn = (prev: (method: string, payload: unknown[], signal?: any) => any, method: string, payload: unknown[], signal?: any) => any
  const installed: TransformerFn[] = []

  /** Wraps a mock method so it runs installed transformers before delegating */
  function withTransformers(methodName: string, impl: (...args: unknown[]) => any) {
    return (...args: unknown[]) => {
      let prev: (method: string, payload: unknown[], signal?: any) => any = (_m, _p, _s) => Promise.resolve({ok: true} as any)
      for (let i = installed.length - 1; i >= 0; i--) {
        const t = installed[i]!
        const next = prev
        prev = (m: string, p: unknown[], s?: any) => t(next, m, p, s)
      }
      prev(methodName, args, undefined)
      return impl(...args)
    }
  }

  const api = {
    config: {
      use: (t: TransformerFn) => installed.push(t)
    },
    sendMessage: withTransformers(`sendMessage`, sendMessage),
    answerCallbackQuery: withTransformers(`answerCallbackQuery`, answerCallbackQuery),
    editMessageText: withTransformers(`editMessageText`, editMessageText),
    deleteMessage: withTransformers(`deleteMessage`, deleteMessage),
    getMe: withTransformers(`getMe`, getMe)
  }

  return {api, mocks: {sendMessage, answerCallbackQuery, editMessageText, deleteMessage, getMe}}
}

function createTestCtx() {
  const {api, mocks} = createMockApi()
  const ct = {api} as unknown as ITCtxParams[`ct`]

  const ctx = new Ctx({
    ct,
    cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {} as unknown as ITCtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })

  return {ctx, mocks}
}

describe(`Ctx answer API transformer`, () => {
  it(`should set isAnswer=true when sendMessage is called via api`, async () => {
    const {ctx, mocks} = createTestCtx()
    expect(ctx.temp.isAnswer).toBe(false)
    await ctx.api.sendMessage(123, `hello`)
    expect(ctx.temp.isAnswer).toBe(true)
    expect(mocks.sendMessage).toHaveBeenCalledWith(123, `hello`)
  })

  it(`should set isAnswer=true when answerCallbackQuery is called via api`, async () => {
    const {ctx, mocks} = createTestCtx()
    expect(ctx.temp.isAnswer).toBe(false)
    await ctx.api.answerCallbackQuery({text: `done`} as any)
    expect(ctx.temp.isAnswer).toBe(true)
    expect(mocks.answerCallbackQuery).toHaveBeenCalledWith({text: `done`})
  })

  it(`should set isAnswer=true when editMessageText is called via api`, async () => {
    const {ctx, mocks} = createTestCtx()
    expect(ctx.temp.isAnswer).toBe(false)
    await ctx.api.editMessageText(`chat_id` as any, 123 as any, `updated` as any)
    expect(ctx.temp.isAnswer).toBe(true)
    expect(mocks.editMessageText).toHaveBeenCalledWith(`chat_id`, 123, `updated`)
  })

  it(`should set isAnswer=true when deleteMessage is called via api`, async () => {
    const {ctx, mocks} = createTestCtx()
    expect(ctx.temp.isAnswer).toBe(false)
    await ctx.api.deleteMessage(123, 456)
    expect(ctx.temp.isAnswer).toBe(true)
    expect(mocks.deleteMessage).toHaveBeenCalledWith(123, 456)
  })

  it(`should NOT set isAnswer when getMe is called via api`, async () => {
    const {ctx, mocks} = createTestCtx()
    expect(ctx.temp.isAnswer).toBe(false)
    const result = await ctx.api.getMe()
    expect(ctx.temp.isAnswer).toBe(false)
    expect(mocks.getMe).toHaveBeenCalledTimes(1)
    expect(result as any).toEqual({id: 1, is_bot: true, first_name: `Bot`})
  })

  it(`should preserve the return value`, async () => {
    const {ctx} = createTestCtx()
    const msg = await ctx.api.sendMessage(123, `test`)
    expect(msg as any).toEqual({message_id: 1, date: 0, chat: {id: 1, type: `private`}})
  })

  it(`should forward all arguments to the original method`, async () => {
    const {ctx, mocks} = createTestCtx()
    await ctx.api.sendMessage(99, `multi`, {parse_mode: `HTML`})
    expect(mocks.sendMessage).toHaveBeenCalledWith(99, `multi`, {parse_mode: `HTML`})
  })
})
