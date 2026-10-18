import {describe, expect, it, mock} from "bun:test"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

// ── Test page class ──────────────────────────────────────────────────

class EditCaptionKeyboardPage extends Ctx {
  static data = this.buildData({name: `render-edit-caption-keyboard-test`})
}

// ── Ctx factory ──────────────────────────────────────────────────────

function createTestCtx() {
  const editError = new Error(`message is too old to edit`)

  const api = {
    config: {use: () => {}},
    editMessageCaption: mock(async () => ({message_id: 2, date: 0, chat: {id: 1, type: `private` as const}}) as any),
    editMessageReplyMarkup: mock(async () => ({message_id: 2, date: 0, chat: {id: 1, type: `private` as const}}) as any),
    editMessageText: mock(async () => ({message_id: 2, date: 0, chat: {id: 1, type: `private` as const}}) as any),
    deleteMessage: mock(async () => true as any),
    sendMessage: mock(async () => ({message_id: 3, date: 0, chat: {id: 1, type: `private` as const}}) as any)
  }

  const ct = {
    api,
    me: {id: 1, is_bot: true, first_name: `Bot`} as any,
    update: {callback_query: {id: `q`, data: `x`, chat_instance: `ci`, message: {message_id: 2, date: 2, text: `m`, chat: {id: 1, type: `private`}, from: {id: 1, is_bot: false, first_name: `Test`}}}} as any
  } as unknown as ICtxParams[`ct`]

  const ctx = new EditCaptionKeyboardPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {
      getGMessage: () => ({kind: `message`, text: `caption hello`, rich: false}),
      getGKeyboard: () => ({kind: `keyboard`, rows: [`Alpha`, `Beta`]})
    } as unknown as ICtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })

  return {ctx, api, editError}
}

// ── Tests ────────────────────────────────────────────────────────────

describe(`Ctx.renderEditCaption`, () => {
  it(`edits the caption with the block text`, async () => {
    const {ctx, api} = createTestCtx()
    await ctx.renderEditCaption({AGBaseId: `photo-card`})
    expect(api.editMessageCaption).toHaveBeenCalledTimes(1)
    expect((api.editMessageCaption.mock.calls as any[])[0][2]).toMatchObject({caption: `caption hello`, parse_mode: `HTML`})
  })

  it(`default delete-reply: deletes the message, then renders the caption as plain text`, async () => {
    const {ctx, api, editError} = createTestCtx()
    api.editMessageCaption.mockImplementation(async () => {
      throw editError
    })
    const result = await ctx.renderEditCaption({AGBaseId: `photo-card`})
    expect(api.deleteMessage).toHaveBeenCalledTimes(1)
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect(result).toEqual({message_id: 3, date: 0, chat: {id: 1, type: `private`}} as any)
  })

  it(`reply: renders the caption without deleting the original`, async () => {
    const {ctx, api, editError} = createTestCtx()
    api.editMessageCaption.mockImplementation(async () => {
      throw editError
    })
    await ctx.renderEditCaption({AGBaseId: `photo-card`, fallbackEdit: `reply`})
    expect(api.deleteMessage).not.toHaveBeenCalled()
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
  })

  it(`disable: rethrows the edit error with no fallback`, async () => {
    const {ctx, api, editError} = createTestCtx()
    api.editMessageCaption.mockImplementation(async () => {
      throw editError
    })
    await expect(ctx.renderEditCaption({AGBaseId: `photo-card`, fallbackEdit: `disable`})).rejects.toBe(editError)
    expect(api.deleteMessage).not.toHaveBeenCalled()
    expect(api.sendMessage).not.toHaveBeenCalled()
  })
})

describe(`Ctx.renderEditKeyboard`, () => {
  it(`edits only the keyboard and never touches message text`, async () => {
    const {ctx, api} = createTestCtx()
    const kb = {inline_keyboard: []} as any
    await ctx.renderEditKeyboard({keyboard: kb, AGBaseId: `photo-card`})
    expect(api.editMessageReplyMarkup).toHaveBeenCalledTimes(1)
    expect((api.editMessageReplyMarkup.mock.calls as any[])[0][2]).toMatchObject({reply_markup: kb})
    expect(api.editMessageText).not.toHaveBeenCalled()
  })

  it(`null keyboard resolves the markup from the AGBaseId keyboard block`, async () => {
    const {ctx, api} = createTestCtx()
    await ctx.renderEditKeyboard({keyboard: null, AGBaseId: `photo-card`})
    expect(api.editMessageReplyMarkup).toHaveBeenCalledTimes(1)
    const sent = (api.editMessageReplyMarkup.mock.calls as any[])[0][2] as {reply_markup: {inline_keyboard: Array<Array<{text: string; callback_data: string}>>}}
    const flat = sent.reply_markup.inline_keyboard.flat()
    expect(flat.map((button) => button.text)).toEqual([`Alpha`, `Beta`])
    expect(api.editMessageText).not.toHaveBeenCalled()
  })

  it(`failure throws after notify with no send fallback`, async () => {
    const {ctx, api, editError} = createTestCtx()
    const seen: unknown[] = []
    api.editMessageReplyMarkup.mockImplementation(async () => {
      throw editError
    })
    const probed = new EditCaptionKeyboardPage({
      ct: {
        api,
        me: {id: 1, is_bot: true, first_name: `Bot`} as any,
        update: {callback_query: {id: `q`, data: `x`, chat_instance: `ci`, message: {message_id: 2, date: 2, text: `m`, chat: {id: 1, type: `private`}, from: {id: 1, is_bot: false, first_name: `Test`}}}} as any
      } as unknown as ICtxParams[`ct`],
      cacheSession: {} as unknown as ICtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager: {
        getGMessage: () => ({kind: `message`, text: `caption hello`, rich: false}),
        getGKeyboard: () => ({kind: `keyboard`, rows: [`Alpha`]})
      } as unknown as ICtxParams[`templateManager`],
      onSendError: ((_e: unknown, info: unknown) => {
        seen.push(info)
      }) as unknown as ICtxParams[`onSendError`],
      temp: {isAnswer: false, session: {}, data: {}}
    })
    await expect(probed.renderEditKeyboard({AGBaseId: `photo-card`})).rejects.toBe(editError)
    expect(api.sendMessage).not.toHaveBeenCalled()
    expect(seen.length).toBe(1)
    void ctx
  })
})
