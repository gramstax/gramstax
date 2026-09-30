import {describe, expect, it, mock} from "bun:test"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

// ── Mock API with stream methods ──────────────────────────────────

function createMockApi() {
  const streamMessage = mock(() => [{message_id: 3, date: 0, chat: {id: 1, type: `private` as const}}])
  const streamMarkdown = mock(() => ({message_id: 4, date: 0, chat: {id: 1, type: `private` as const}}))
  const streamHtml = mock(() => ({message_id: 5, date: 0, chat: {id: 1, type: `private` as const}}))

  const api = {
    config: {use: () => {}},
    streamMessage,
    streamMarkdown,
    streamHtml
  }

  return {api, mocks: {streamMessage, streamMarkdown, streamHtml}}
}

// ── Ctx factory ───────────────────────────────────────────────────

function createTestCtx(update: Record<string, unknown> = {}) {
  const {api, mocks} = createMockApi()

  const ct = {
    api,
    me: {id: 1, is_bot: true, first_name: `Bot`} as any,
    update: {
      update_id: 42,
      message: {message_id: 1, chat: {id: 7, type: `private`}, text: `test`, from: {id: 2, is_bot: false, first_name: `Test`}},
      ...update
    } as any
  } as unknown as ICtxParams[`ct`]

  const ctx = new Ctx({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {} as unknown as ICtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })

  return {ctx, mocks}
}

// ── Tests: replyWithStream ────────────────────────────────────────

describe(`Ctx.replyWithStream`, () => {
  it(`calls api.streamMessage with chat id and draft offset 256 * update_id`, async () => {
    const {ctx, mocks} = createTestCtx()
    const stream = [`chunk 1`, `chunk 2`]

    await ctx.replyWithStream(stream as any)

    expect(mocks.streamMessage).toHaveBeenCalledTimes(1)
    expect(mocks.streamMessage).toHaveBeenCalledWith(7, 256 * 42, stream, {}, {}, undefined)
  })

  it(`forwards otherMessageDraft and otherMessage merged`, async () => {
    const {ctx, mocks} = createTestCtx()
    const stream = [`hi`]

    await ctx.replyWithStream(stream as any, {parse_mode: `HTML`} as any, {disable_notification: true} as any)

    expect(mocks.streamMessage).toHaveBeenCalledWith(7, 256 * 42, stream, {parse_mode: `HTML`}, {disable_notification: true}, undefined)
  })

  it(`passes the signal through`, async () => {
    const {ctx, mocks} = createTestCtx()
    const signal = new AbortController().signal

    await ctx.replyWithStream([`x`] as any, undefined, undefined, signal as any)

    expect(mocks.streamMessage).toHaveBeenCalledWith(7, 256 * 42, [`x`], {}, {}, signal)
  })

  it(`adds message_thread_id for topic messages`, async () => {
    const {ctx, mocks} = createTestCtx({
      message: {message_id: 1, chat: {id: 7, type: `supergroup`, is_forum: true}, message_thread_id: 99, is_topic_message: true, text: `test`, from: {id: 2, is_bot: false, first_name: `Test`}}
    })

    await ctx.replyWithStream([`x`] as any)

    expect(mocks.streamMessage).toHaveBeenCalledWith(7, 256 * 42, [`x`], {message_thread_id: 99}, {message_thread_id: 99}, undefined)
  })

  it(`throws when the update does not belong to a chat`, async () => {
    const {ctx, mocks} = createTestCtx({message: undefined, callback_query: {id: `8`, from: {id: 2, is_bot: false, first_name: `Test`}, data: `x`}})

    await expect(ctx.replyWithStream([`x`] as any)).rejects.toThrow(`This update does not belong to a chat, so you cannot call 'streamMessage'`)
    expect(mocks.streamMessage).not.toHaveBeenCalled()
  })

  it(`returns the array of sent messages from api.streamMessage`, async () => {
    const {ctx, mocks} = createTestCtx()
    const sent = [{message_id: 3, date: 0, chat: {id: 1, type: `private` as const}}]
    mocks.streamMessage.mockReturnValue(sent)

    const result = await ctx.replyWithStream([`x`] as any)

    expect(result).toEqual(sent)
  })
})

// ── Tests: replyWithMarkdownStream ────────────────────────────────

describe(`Ctx.replyWithMarkdownStream`, () => {
  it(`calls api.streamMarkdown with chat id and update_id as draft id`, async () => {
    const {ctx, mocks} = createTestCtx()
    const stream = [`# header`, `body`]

    await ctx.replyWithMarkdownStream(stream as any)

    expect(mocks.streamMarkdown).toHaveBeenCalledTimes(1)
    expect(mocks.streamMarkdown).toHaveBeenCalledWith(7, 42, stream, {}, {}, undefined, undefined)
  })

  it(`forwards rich message params and signal`, async () => {
    const {ctx, mocks} = createTestCtx()
    const signal = new AbortController().signal

    await ctx.replyWithMarkdownStream([`x`] as any, {parse_mode: `HTML`} as any, {disable_notification: true} as any, {skip_entity_detection: false} as any, signal as any)

    expect(mocks.streamMarkdown).toHaveBeenCalledWith(7, 42, [`x`], {parse_mode: `HTML`}, {disable_notification: true}, {skip_entity_detection: false}, signal)
  })

  it(`adds message_thread_id for topic messages`, async () => {
    const {ctx, mocks} = createTestCtx({
      message: {message_id: 1, chat: {id: 7, type: `supergroup`, is_forum: true}, message_thread_id: 99, is_topic_message: true, text: `test`, from: {id: 2, is_bot: false, first_name: `Test`}}
    })

    await ctx.replyWithMarkdownStream([`x`] as any)

    expect(mocks.streamMarkdown).toHaveBeenCalledWith(7, 42, [`x`], {message_thread_id: 99}, {message_thread_id: 99}, undefined, undefined)
  })

  it(`throws when the update does not belong to a chat`, async () => {
    const {ctx, mocks} = createTestCtx({message: undefined, callback_query: {id: `8`, from: {id: 2, is_bot: false, first_name: `Test`}, data: `x`}})

    await expect(ctx.replyWithMarkdownStream([`x`] as any)).rejects.toThrow(`This update does not belong to a chat, so you cannot call 'streamMarkdown'`)
    expect(mocks.streamMarkdown).not.toHaveBeenCalled()
  })
})

// ── Tests: replyWithHtmlStream ────────────────────────────────────

describe(`Ctx.replyWithHtmlStream`, () => {
  it(`calls api.streamHtml with chat id and update_id as draft id`, async () => {
    const {ctx, mocks} = createTestCtx()
    const stream = [`<b>bold</b>`, `tail`]

    await ctx.replyWithHtmlStream(stream as any)

    expect(mocks.streamHtml).toHaveBeenCalledTimes(1)
    expect(mocks.streamHtml).toHaveBeenCalledWith(7, 42, stream, {}, {}, undefined, undefined)
  })

  it(`forwards rich message params and signal`, async () => {
    const {ctx, mocks} = createTestCtx()
    const signal = new AbortController().signal

    await ctx.replyWithHtmlStream([`x`] as any, {parse_mode: `HTML`} as any, {disable_notification: true} as any, {skip_entity_detection: false} as any, signal as any)

    expect(mocks.streamHtml).toHaveBeenCalledWith(7, 42, [`x`], {parse_mode: `HTML`}, {disable_notification: true}, {skip_entity_detection: false}, signal)
  })

  it(`adds message_thread_id for topic messages`, async () => {
    const {ctx, mocks} = createTestCtx({
      message: {message_id: 1, chat: {id: 7, type: `supergroup`, is_forum: true}, message_thread_id: 99, is_topic_message: true, text: `test`, from: {id: 2, is_bot: false, first_name: `Test`}}
    })

    await ctx.replyWithHtmlStream([`x`] as any)

    expect(mocks.streamHtml).toHaveBeenCalledWith(7, 42, [`x`], {message_thread_id: 99}, {message_thread_id: 99}, undefined, undefined)
  })

  it(`throws when the update does not belong to a chat`, async () => {
    const {ctx, mocks} = createTestCtx({message: undefined, callback_query: {id: `8`, from: {id: 2, is_bot: false, first_name: `Test`}, data: `x`}})

    await expect(ctx.replyWithHtmlStream([`x`] as any)).rejects.toThrow(`This update does not belong to a chat, so you cannot call 'streamHtml'`)
    expect(mocks.streamHtml).not.toHaveBeenCalled()
  })
})
