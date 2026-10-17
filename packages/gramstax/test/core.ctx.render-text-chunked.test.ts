import {describe, expect, it, mock} from "bun:test"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

// ── Test page class ──────────────────────────────────────────────────

class RenderTextChunkedPage extends Ctx {
  static data = this.buildData({name: `render-text-chunked-test`})
}

// ── Helpers ──────────────────────────────────────────────────────────

const messageUpdate = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

function createCtx(api: Record<string, unknown>, text = `hello`, rich = false) {
  const ct = {
    api,
    me: {id: 9, is_bot: true, first_name: `Bot`} as any,
    update: messageUpdate as any
  } as unknown as ICtxParams[`ct`]
  return new RenderTextChunkedPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {getGMessage: () => ({kind: `message`, text, rich}), getGKeyboard: () => []} as unknown as ICtxParams[`templateManager`],
    onSendError: null as unknown as ICtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

function makeApi(overrides?: Record<string, unknown>) {
  return {
    config: {use: () => {}},
    sendMessage: mock(async () => ({message_id: 9, date: 0, chat: {id: 1, type: `private` as const}}) as any),
    sendRichMessage: mock(async () => ({message_id: 9, date: 0, chat: {id: 1, type: `private` as const}}) as any),
    ...(overrides ?? {})
  }
}

const sendExtras = (api: {sendMessage: any}) => (api.sendMessage.mock.calls as any[]).map((call) => call[2] as Record<string, unknown> | undefined)
const sentTexts = (api: {sendMessage: any}) => (api.sendMessage.mock.calls as any[]).map((call) => call[1] as string)

// ── renderText chunkSize ─────────────────────────────────────────────

describe(`Ctx.renderText chunkSize (chunked reply)`, () => {
  it(`chunkSize splits the text across N sendMessage calls with the keyboard on the LAST one only`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, `a`.repeat(9000))
    const kb = {inline_keyboard: []} as any
    const out = await ctx.renderText({keyboard: kb, chunkSize: 4096})
    expect(api.sendMessage).toHaveBeenCalledTimes(3)
    expect(Array.isArray(out)).toBe(true)
    expect((out as unknown[]).length).toBe(3)
    const extras = sendExtras(api)
    expect(extras.map((extra) => extra?.parse_mode)).toEqual([`HTML`, `HTML`, `HTML`])
    expect(extras[0]?.reply_markup).toBeUndefined()
    expect(extras[1]?.reply_markup).toBeUndefined()
    expect(extras[2]?.reply_markup).toBe(kb)
  })

  it(`without chunkSize a single sendMessage carries the keyboard`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, `short text`)
    const kb = {inline_keyboard: []} as any
    await ctx.renderText({keyboard: kb})
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    const extras = sendExtras(api)
    expect(extras.length).toBe(1)
    expect(extras[0]?.reply_markup).toBe(kb)
  })

  it(`a rich template with chunkSize sends every chunk through the rich path`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, `r`.repeat(5000), true)
    const kb = {inline_keyboard: []} as any
    await ctx.renderText({keyboard: kb, chunkSize: 4096})
    expect(api.sendMessage).not.toHaveBeenCalled()
    expect(api.sendRichMessage).toHaveBeenCalledTimes(2)
    const richCalls = api.sendRichMessage.mock.calls as any[]
    expect(richCalls[0]![1]).toEqual({html: `r`.repeat(4096)})
    expect(richCalls[1]![1]).toEqual({html: `r`.repeat(904)})
    expect(richCalls[0]![2]?.reply_markup).toBeUndefined()
    expect(richCalls[1]![2]?.reply_markup).toBe(kb)
  })

  it(`the deterministic cut prefers \n\n, then \n, then space`, async () => {
    // Paragraph boundary: the window holds both `\n\n` (index 1) and a later `\n` (index 4) — the paragraph wins.
    const apiParagraph = makeApi()
    await createCtx(apiParagraph, `a\n\nb\nc${`d`.repeat(20)}`).renderText({chunkSize: 6})
    expect(sentTexts(apiParagraph)[0]).toBe(`a`)

    // Newline boundary: no `\n\n`, so the LAST `\n` in the window wins over the earlier space.
    const apiNewline = makeApi()
    await createCtx(apiNewline, `ab cd\nef${`g`.repeat(20)}`).renderText({chunkSize: 7})
    expect(sentTexts(apiNewline)[0]).toBe(`ab cd`)

    // Space boundary: no newline at all — the last space in the window wins over a hard cut.
    const apiSpace = makeApi()
    await createCtx(apiSpace, `ab cd ef${`g`.repeat(20)}`).renderText({chunkSize: 5})
    expect(sentTexts(apiSpace)[0]).toBe(`ab`)
  })
})
