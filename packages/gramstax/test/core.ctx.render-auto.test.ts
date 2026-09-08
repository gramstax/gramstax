import {describe, expect, it, mock} from "bun:test"
import {InlineKeyboard} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ITCtxParams} from "~/types/t.ctx"

// ── Test page class (simulates user's PageBase pattern) ────────────

class TestPage extends Ctx {
  static data = this.buildData({name: `render-auto-test`})

  gdefault = {
    show: async () => {
      await this.renderAuto(null, null, null, null)
    }
  }
}

// ── Mock API factory (mirrors answer-proxy.test.ts) ─────────────────

function createMockApi() {
  type TransformerFn = (prev: (method: string, payload: unknown[], signal?: any) => any, method: string, payload: unknown[], signal?: any) => any
  const installed: TransformerFn[] = []

  const sendMessage = mock(() => ({message_id: 1, date: 0, chat: {id: 1, type: `private` as const}} as any))
  const editMessageText = mock(() => ({message_id: 1, date: 0, chat: {id: 1, type: `private` as const}} as any))

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
      ? ({callback_query: {id: `999`, from: {id: 1, is_bot: false, first_name: `Test`}, data: `test`}} as any)
      : ({message: {chat: {id: 1, type: `private`}, text: `test`, from: {id: 1, is_bot: false, first_name: `Test`}}} as any)
  } as unknown as ITCtxParams[`ct`]

  const ctx = new TestPage({
    ct,
    cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {} as unknown as ITCtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })

  return {ctx, mocks}
}

// ── Tests ──────────────────────────────────────────────────────────

describe(`Ctx.renderAuto`, () => {
  // ── Auto-detection ─────────────────────────────────────────────

  it(`should call render when no callbackQuery (auto-detect = false)`, async () => {
    const {ctx} = createTestCtx(false)
    const renderSpy = mock(() => Promise.resolve({message_id: 1} as any))
    const renderEditSpy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.render = renderSpy as any
    ctx.renderEdit = renderEditSpy as any

    await ctx.renderAuto()

    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(renderEditSpy).not.toHaveBeenCalled()
  })

  it(`should call renderEdit when callbackQuery exists (auto-detect = true)`, async () => {
    const {ctx} = createTestCtx(true)
    const renderSpy = mock(() => Promise.resolve({message_id: 1} as any))
    const renderEditSpy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.render = renderSpy as any
    ctx.renderEdit = renderEditSpy as any

    await ctx.renderAuto()

    expect(renderEditSpy).toHaveBeenCalledTimes(1)
    expect(renderSpy).not.toHaveBeenCalled()
  })

  // ── Forwards keyboard & data arguments ─────────────────────────

  it(`should forward keyboard and data to render`, async () => {
    const {ctx} = createTestCtx(false)
    const kb = new InlineKeyboard().text(`OK`, `ok`)
    const da = {msg: `hello`}
    const renderSpy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.render = renderSpy as any

    await ctx.renderAuto(kb, da)

    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(renderSpy).toHaveBeenCalledWith(kb, da, undefined, undefined)
  })

  it(`should forward keyboard and data to renderEdit`, async () => {
    const {ctx} = createTestCtx(true)
    const kb = new InlineKeyboard().text(`OK`, `ok`)
    const da = {msg: `hello`}
    const renderEditSpy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.renderEdit = renderEditSpy as any

    await ctx.renderAuto(kb, da, null, null)

    expect(renderEditSpy).toHaveBeenCalledTimes(1)
    expect(renderEditSpy).toHaveBeenCalledWith(kb, da, null, null, `delete-reply`)
  })

  // ── Direct page pattern: new TestPage(this).gdefault.show() ────

  it(`should auto-detect via page show() pattern without callbackQuery`, async () => {
    const {ctx} = createTestCtx(false)
    const renderSpy = mock(() => Promise.resolve({message_id: 1} as any))
    const renderEditSpy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.render = renderSpy as any
    ctx.renderEdit = renderEditSpy as any

    // Simulate: new TestPage(this).gdefault.show()
    await ctx.gdefault.show()

    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(renderEditSpy).not.toHaveBeenCalled()
  })

  it(`should auto-detect via page show() pattern with callbackQuery`, async () => {
    const {ctx} = createTestCtx(true)
    const renderSpy = mock(() => Promise.resolve({message_id: 1} as any))
    const renderEditSpy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.render = renderSpy as any
    ctx.renderEdit = renderEditSpy as any

    // Simulate: new TestPage(this).gdefault.show()
    await ctx.gdefault.show()

    expect(renderEditSpy).toHaveBeenCalledTimes(1)
    expect(renderSpy).not.toHaveBeenCalled()
  })
})