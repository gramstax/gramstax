import {describe, expect, it, mock} from "bun:test"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

// ── Test page class ──────────────────────────────────────────────────

class ThreadChunkedPage extends Ctx {
  static data = this.buildData({name: `thread-chunked-test`})
}

// ── Helpers ──────────────────────────────────────────────────────────

const messageUpdate = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

function createCtx(api: Record<string, unknown>, text = `hello`, extra?: {onSendError?: unknown}) {
  const ct = {
    api,
    me: {id: 9, is_bot: true, first_name: `Bot`} as any,
    update: messageUpdate as any
  } as unknown as ICtxParams[`ct`]
  return new ThreadChunkedPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {getGMessage: () => text, getGKeyboard: () => []} as unknown as ICtxParams[`templateManager`],
    onSendError: (extra?.onSendError ?? null) as unknown as ICtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

function makeApi(overrides?: Record<string, unknown>) {
  return {
    config: {use: () => {}},
    sendMessage: mock(async () => ({message_id: 9, date: 0, chat: {id: 1, type: `private` as const}}) as any),
    ...(overrides ?? {})
  }
}

const sendExtras = (api: {sendMessage: any}) => (api.sendMessage.mock.calls as any[]).map((call) => call[2] as Record<string, unknown> | undefined)

// ── renderChunked ────────────────────────────────────────────────────

describe(`Ctx.renderChunked`, () => {
  it(`9000-char text yields 3 sends (2x4096 + rest)`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, `a`.repeat(9000))
    const out = await ctx.renderChunked(undefined, undefined, `long-card`)
    expect(api.sendMessage).toHaveBeenCalledTimes(3)
    expect(out.length).toBe(3)
    const texts = (api.sendMessage.mock.calls as any[]).map((call) => call[1] as string)
    expect(texts.map((text) => text.length)).toEqual([4096, 4096, 808])
  })

  it(`keyboard appears ONLY on the last chunk`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, `b`.repeat(5000))
    const kb = {inline_keyboard: []} as any
    await ctx.renderChunked(kb, undefined, `long-card`)
    const extras = sendExtras(api)
    expect(extras.length).toBe(2)
    expect(extras[0]?.reply_markup).toBeUndefined()
    expect(extras[1]?.reply_markup).toBe(kb)
  })

  it(`placeholders resolve before splitting and never split across chunks`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, `hello World ${`c`.repeat(9000)}`)
    await ctx.renderChunked(undefined, {name: `World`}, `long-card`)
    const texts = (api.sendMessage.mock.calls as any[]).map((call) => call[1] as string)
    expect(texts.filter((text) => text.includes(`World`)).length).toBe(1)
    expect(texts.join(``)).toContain(`hello World`)
  })

  it(`prefers paragraph boundaries over hard cuts`, async () => {
    const api = makeApi()
    const filler = `d`.repeat(100)
    const ctx = createCtx(api, `line-one\n\n${filler}`)
    await ctx.renderChunked(undefined, undefined, `long-card`, undefined, 20)
    const texts = (api.sendMessage.mock.calls as any[]).map((call) => call[1] as string)
    expect(texts[0]).toBe(`line-one`)
  })

  it(`mid-loop failure throws with the recorded chunk index`, async () => {
    const err = new Error(`flood`)
    let calls = 0
    const seen: unknown[] = []
    const api = makeApi({
      sendMessage: mock(async () => {
        calls += 1
        if (calls === 2) throw err
        return {message_id: calls} as any
      })
    })
    const ctx = createCtx(api, `e`.repeat(9000), {
      onSendError: (_e: unknown, info: unknown) => {
        seen.push(info)
      }
    })
    await expect(ctx.renderChunked(undefined, undefined, `long-card`)).rejects.toBe(err)
    expect((err as {chunkIndex?: number}).chunkIndex).toBe(1)
    expect(api.sendMessage).toHaveBeenCalledTimes(2)
    expect(seen.length).toBe(1)
  })
})
