import {describe, expect, it, mock} from "bun:test"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

function createMockApi() {
  const calls: Array<{method: string; body: unknown}> = []
  const sendMessage = mock((chatId: unknown, text: unknown, opts?: unknown) => {
    calls.push({method: `sendMessage`, body: {chat_id: chatId, text, ...((opts as object) ?? {})}})
    return Promise.resolve({message_id: 1} as unknown as never)
  })
  const sendPhoto = mock((chatId: unknown, photo: unknown, opts?: unknown) => {
    calls.push({method: `sendPhoto`, body: {chat_id: chatId, photo, ...((opts as object) ?? {})}})
    return Promise.resolve({message_id: 2} as unknown as never)
  })
  const sendRichMessage = mock((chatId: unknown, rich: unknown, opts?: unknown) => {
    calls.push({method: `sendRichMessage`, body: {chat_id: chatId, rich_message: rich, ...((opts as object) ?? {})}})
    return Promise.resolve({message_id: 3} as unknown as never)
  })
  const editEphemeralMessageText = mock((chatId: unknown, messageId: unknown, businessConnectionId: unknown, rich: unknown, opts?: unknown) => {
    calls.push({method: `editEphemeralMessageText`, body: {chat_id: chatId, message_id: messageId, business_connection_id: businessConnectionId, rich_message: rich, ...((opts as object) ?? {})}})
    return Promise.resolve(true as unknown as never)
  })
  const editEphemeralMessageCaption = mock((chatId: unknown, messageId: unknown, businessConnectionId: unknown, caption: unknown, opts?: unknown) => {
    calls.push({method: `editEphemeralMessageCaption`, body: {chat_id: chatId, message_id: messageId, business_connection_id: businessConnectionId, caption, ...((opts as object) ?? {})}})
    return Promise.resolve(true as unknown as never)
  })
  const editEphemeralMessageMedia = mock((chatId: unknown, messageId: unknown, businessConnectionId: unknown, media: unknown, opts?: unknown) => {
    calls.push({method: `editEphemeralMessageMedia`, body: {chat_id: chatId, message_id: messageId, business_connection_id: businessConnectionId, media, ...((opts as object) ?? {})}})
    return Promise.resolve(true as unknown as never)
  })
  const deleteEphemeralMessage = mock((chatId: unknown, messageId: unknown, businessConnectionId?: unknown) => {
    calls.push({method: `deleteEphemeralMessage`, body: {chat_id: chatId, message_id: messageId, business_connection_id: businessConnectionId}})
    return Promise.resolve(true as unknown as never)
  })
  const promoteChatMember = mock((chatId: unknown, userId: unknown, opts?: unknown) => {
    calls.push({method: `promoteChatMember`, body: {chat_id: chatId, user_id: userId, ...((opts as object) ?? {})}})
    return Promise.resolve(true as unknown as never)
  })

  type TransformerFn = (prev: (method: string, payload: unknown, signal?: unknown) => unknown, method: string, payload: unknown, signal?: unknown) => unknown
  const installed: TransformerFn[] = []
  const api: Record<string, unknown> = {
    config: {use: (t: TransformerFn) => installed.push(t)},
    sendMessage,
    sendPhoto,
    sendRichMessage,
    editEphemeralMessageText,
    editEphemeralMessageCaption,
    editEphemeralMessageMedia,
    deleteEphemeralMessage,
    promoteChatMember
  }
  // Provide raw-like invoke to trigger transformer echo
  const rawInvoke = async (method: string, payload: unknown) => {
    let prev: (m: string, p: unknown, s?: unknown) => unknown = (_m, _p) => Promise.resolve({ok: true} as unknown)
    for (let i = installed.length - 1; i >= 0; i--) {
      const t = installed[i]!
      const next = prev
      prev = (m: string, p: unknown, s?: unknown) => t(next, m, p, s)
    }
    await prev(method, payload as unknown[], undefined)
    // Also call mock if exists
    const fn = api[method] as ((p: unknown) => unknown) | undefined
    if (fn) await (fn as (p: unknown) => unknown)(payload)
  }
  return {api: api as unknown, calls, mocks: {sendMessage, sendPhoto, sendRichMessage, editEphemeralMessageText, editEphemeralMessageCaption, editEphemeralMessageMedia, deleteEphemeralMessage, promoteChatMember}, rawInvoke}
}

function createCtx() {
  const {api, calls, mocks, rawInvoke} = createMockApi()
  const ct = {api, update: {message: {chat: {id: 1, type: `private`}, from: {id: 1, first_name: `Test`}}}, me: {id: 1, is_bot: true, first_name: `Bot`}} as unknown as ICtxParams[`ct`]
  const ctx = new Ctx({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {getGMessage: () => `hello`} as unknown as ICtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
  return {ctx, calls, mocks, api, rawInvoke}
}

describe(`ephemeral_message_parameters`, () => {
  it(`maps old args to new object with deprecation`, () => {
    // Static helper must exist
    const params = Ctx.ephemeralParams
    expect(params).toBeDefined()
    const result = Ctx.ephemeralParams(123, `cb_1`)
    expect(result).toEqual({receiver_user_id: 123, callback_query_id: `cb_1`})
  })

  it(`deprecated overload shim maps snake_case object + warns`, () => {
    const warnSpy = mock(() => {})
    const origWarn = console.warn
    console.warn = warnSpy
    const legacy = {receiver_user_id: 456, callback_query_id: `legacy_cb`}
    const result = Ctx.ephemeralParams(legacy)
    expect(result).toEqual({receiver_user_id: 456, callback_query_id: `legacy_cb`})
    expect(warnSpy).toHaveBeenCalled()
    console.warn = origWarn
  })

  it(`sendMessage with ephemeral_message_parameters passes through`, async () => {
    const {ctx, calls} = createCtx()
    const ephemeral = Ctx.ephemeralParams(999, `cq_123`, true)
    // Use api directly with ephemeral params — must be forwarded
    await ctx.api.sendMessage(1, `hello`, {ephemeral_message_parameters: ephemeral})
    const last = calls[calls.length - 1]
    expect(last?.method).toBe(`sendMessage`)
    expect((last?.body as Record<string, unknown>).ephemeral_message_parameters).toEqual({
      receiver_user_id: 999,
      callback_query_id: `cq_123`,
      replace_callback_query_message: true
    })
  })

  it(`replace_callback_query_message true shows in place`, async () => {
    const {ctx, calls} = createCtx()
    const params = Ctx.ephemeralParams(777, `query_777`, true)
    expect(params!.replace_callback_query_message).toBe(true)
    await ctx.api.sendMessage(1, `hi`, {ephemeral_message_parameters: params})
    const body = calls[calls.length - 1]?.body as Record<string, unknown>
    const ep = body.ephemeral_message_parameters as Record<string, unknown>
    expect(ep.replace_callback_query_message).toBe(true)
    // false case
    const params2 = Ctx.ephemeralParams(777, `query_777`, false)
    expect(params2!.replace_callback_query_message).toBe(false)
  })

  it(`instance helper mirrors static helper`, () => {
    const {ctx} = createCtx()
    const inst = ctx.ephemeralParams
    expect(inst).toBeDefined()
    const r = ctx.ephemeralParams(1, `id`)
    expect(r).toEqual({receiver_user_id: 1, callback_query_id: `id`})
  })

  it(`can_send_welcome_messages forwarded via promoteChatMember`, async () => {
    const {ctx, calls} = createCtx()
    await ctx.api.promoteChatMember(1, 2, {can_send_welcome_messages: true})
    const last = calls[calls.length - 1]
    expect(last?.method).toBe(`promoteChatMember`)
    expect((last?.body as Record<string, unknown>).can_send_welcome_messages).toBe(true)
  })

  it(`editEphemeralMessageText accepts rich_message`, async () => {
    const {ctx, calls} = createCtx()
    await ctx.api.editEphemeralMessageText(1, 2, 3, {html: `<b>hi</b>`})
    const last = calls[calls.length - 1]
    expect(last?.method).toBe(`editEphemeralMessageText`)
    expect((last?.body as Record<string, unknown>).rich_message).toEqual({html: `<b>hi</b>`})
  })

  it(`editEphemeralMessageCaption accepts show_caption_above_media`, async () => {
    const {ctx, calls} = createCtx()
    await ctx.api.editEphemeralMessageCaption(1, 2, 3, `cap`, {show_caption_above_media: true})
    const last = calls[calls.length - 1]
    expect(last?.method).toBe(`editEphemeralMessageCaption`)
    expect((last?.body as Record<string, unknown>).show_caption_above_media).toBe(true)
  })

  it(`editEphemeralMessageMedia supports file upload`, async () => {
    const {ctx, calls} = createCtx()
    await ctx.api.editEphemeralMessageMedia(1, 2, 3, {type: `photo`, media: `attach://file`})
    const last = calls[calls.length - 1]
    expect(last?.method).toBe(`editEphemeralMessageMedia`)
    expect((last?.body as Record<string, unknown>).media).toBeDefined()
  })
})
