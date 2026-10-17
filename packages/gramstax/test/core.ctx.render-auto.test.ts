import {describe, expect, it, mock} from "bun:test"
import {InlineKeyboard} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

// ── Test page class (simulates user's PageBase pattern) ────────────

class TestPage extends Ctx {
  static data = this.buildData({name: `render-auto-test`})

  gdefault = {
    show: async () => {
      await this.renderText()
    }
  }
}

// ── Mock API factory (mirrors answer-proxy.test.ts) ─────────────────

function createMockApi() {
  type TransformerFn = (prev: (method: string, payload: unknown[], signal?: any) => any, method: string, payload: unknown[], signal?: any) => any
  const installed: TransformerFn[] = []

  const sendMessage = mock(() => ({message_id: 1, date: 0, chat: {id: 1, type: `private` as const}}) as any)
  const editMessageText = mock(() => ({message_id: 1, date: 0, chat: {id: 1, type: `private` as const}}) as any)

  return {
    api: {
      config: {use: (t: TransformerFn) => installed.push(t)},
      sendMessage,
      editMessageText
    },
    mocks: {sendMessage, editMessageText}
  }
}

// ── Ctx factory ────────────────────────────────────────────────────

function createTestCtx(hasCallbackQuery = false) {
  const {api, mocks} = createMockApi()

  const ct = {
    api,
    me: {id: 1, is_bot: true, first_name: `Bot`} as any,
    update: hasCallbackQuery
      ? ({callback_query: {id: `999`, from: {id: 1, is_bot: false, first_name: `Test`}, data: `test`, message: {message_id: 2, date: 2, chat: {id: 1, type: `private`}, text: `m`, from: {id: 1, is_bot: false, first_name: `Test`}}}} as any)
      : ({message: {chat: {id: 1, type: `private`}, text: `test`, from: {id: 1, is_bot: false, first_name: `Test`}}} as any)
  } as unknown as ICtxParams[`ct`]

  const ctx = new TestPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {getGMessage: mock(() => ({kind: `message`, text: `hello`, rich: false}))} as unknown as ICtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })

  return {ctx, mocks}
}

// ── Tests ──────────────────────────────────────────────────────────

describe(`Ctx.renderText auto-detect`, () => {
  // ── Auto-detection ─────────────────────────────────────────────

  it(`should reply when no callbackQuery (auto-detect = false)`, async () => {
    const {ctx, mocks} = createTestCtx(false)

    await ctx.renderText()

    expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
    expect(mocks.editMessageText).not.toHaveBeenCalled()
  })

  it(`should edit when callbackQuery exists (auto-detect = true)`, async () => {
    const {ctx, mocks} = createTestCtx(true)

    await ctx.renderText()

    expect(mocks.editMessageText).toHaveBeenCalledTimes(1)
    expect(mocks.sendMessage).not.toHaveBeenCalled()
  })

  // ── Forwards keyboard & data arguments ─────────────────────────

  it(`should forward keyboard and data to the reply`, async () => {
    const {ctx, mocks} = createTestCtx(false)
    const kb = new InlineKeyboard().text(`OK`, `ok`)
    const da = {msg: `hello`}

    await ctx.renderText({keyboard: kb, data: da})

    expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
    const call = mocks.sendMessage.mock.calls[0] as unknown[]
    expect(call[0]).toBe(1)
    expect(call[1]).toBe(`hello`)
    expect(call[2]).toMatchObject({parse_mode: `HTML`, reply_markup: kb})
  })

  it(`should forward keyboard and data to the edit`, async () => {
    const {ctx, mocks} = createTestCtx(true)
    const kb = new InlineKeyboard().text(`OK`, `ok`)
    const da = {msg: `hello`}

    await ctx.renderText({keyboard: kb, data: da})

    expect(mocks.editMessageText).toHaveBeenCalledTimes(1)
    const call = mocks.editMessageText.mock.calls[0] as unknown[]
    expect(call[0]).toBe(1)
    expect(call[1]).toBe(2)
    expect(call[2]).toBe(`hello`)
    expect(call[3]).toMatchObject({parse_mode: `HTML`, reply_markup: kb})
  })

  it(`should force a reply for a callback update with mode reply`, async () => {
    const {ctx, mocks} = createTestCtx(true)

    await ctx.renderText({mode: `reply`})

    expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
    expect(mocks.editMessageText).not.toHaveBeenCalled()
  })

  // ── Direct page pattern: new TestPage(this).gdefault.show() ────

  it(`should auto-detect via page show() pattern without callbackQuery`, async () => {
    const {ctx, mocks} = createTestCtx(false)

    // Simulate: new TestPage(this).gdefault.show()
    await ctx.gdefault.show()

    expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
    expect(mocks.editMessageText).not.toHaveBeenCalled()
  })

  it(`should auto-detect via page show() pattern with callbackQuery`, async () => {
    const {ctx, mocks} = createTestCtx(true)

    // Simulate: new TestPage(this).gdefault.show()
    await ctx.gdefault.show()

    expect(mocks.editMessageText).toHaveBeenCalledTimes(1)
    expect(mocks.sendMessage).not.toHaveBeenCalled()
  })
})
