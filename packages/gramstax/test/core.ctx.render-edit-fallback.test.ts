import {describe, expect, it, mock} from "bun:test"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

// ── Test page class ────────────────────────────────────────────────

class TestPage extends Ctx {
  static data = this.buildData({name: `render-edit-fallback-test`})
}

// ── Ctx factory with failing editMessageText ───────────────────────

function createTestCtx() {
  const editError = new Error(`message is too old to edit`)

  const api = {
    config: {use: () => {}},
    editMessageText: mock(() => {
      throw editError
    }),
    editMessageMedia: mock(() => {
      throw editError
    }),
    deleteMessage: mock(() => ({ok: true}) as any),
    sendMessage: mock(() => ({message_id: 2, date: 0, chat: {id: 1, type: `private` as const}}) as any),
    sendPhoto: mock(() => ({message_id: 2, date: 0, chat: {id: 1, type: `private` as const}}) as any)
  }

  const ct = {
    api,
    me: {id: 1, is_bot: true, first_name: `Bot`} as any,
    update: {message: {message_id: 1, chat: {id: 1, type: `private`}, text: `test`, from: {id: 1, is_bot: false, first_name: `Test`}}} as any
  } as unknown as ICtxParams[`ct`]

  const ctx = new TestPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {
      getGMessage: () => ({kind: `message`, text: `hello`, rich: false}),
      getGMedia: () => ({src: `https://example.com/a.jpg`, caption: `hi`})
    } as unknown as ICtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })

  return {ctx, api, editError}
}

// ── Tests ──────────────────────────────────────────────────────────

describe(`Ctx.renderText edit fallbackEdit modes`, () => {
  it(`default delete-reply: deletes the message, then renders a new reply`, async () => {
    const {ctx, api} = createTestCtx()

    const result = await ctx.renderText({mode: `edit`})

    expect(api.deleteMessage).toHaveBeenCalledTimes(1)
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect(result).toEqual({message_id: 2, date: 0, chat: {id: 1, type: `private`}} as any)
  })

  it(`delete-reply: still sends the reply when message deletion fails`, async () => {
    const {ctx, api} = createTestCtx()
    api.deleteMessage.mockImplementation(() => {
      throw new Error(`message already deleted`)
    })

    const result = await ctx.renderText({mode: `edit`, fallbackEdit: `delete-reply`})

    expect(api.deleteMessage).toHaveBeenCalledTimes(1)
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect(result).toEqual({message_id: 2, date: 0, chat: {id: 1, type: `private`}} as any)
  })

  it(`reply: renders a new reply without deleting the original`, async () => {
    const {ctx, api} = createTestCtx()

    const result = await ctx.renderText({mode: `edit`, fallbackEdit: `reply`})

    expect(api.deleteMessage).not.toHaveBeenCalled()
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect(result).toEqual({message_id: 2, date: 0, chat: {id: 1, type: `private`}} as any)
  })

  it(`disable: rethrows the edit error with no fallback`, async () => {
    const {ctx, api, editError} = createTestCtx()

    await expect(ctx.renderText({mode: `edit`, fallbackEdit: `disable`})).rejects.toBe(editError)

    expect(api.deleteMessage).not.toHaveBeenCalled()
    expect(api.sendMessage).not.toHaveBeenCalled()
  })
})

describe(`Ctx.renderMedia edit fallbackEdit modes`, () => {
  it(`delete-reply: deletes the message, then re-sends the same media type`, async () => {
    const {ctx, api} = createTestCtx()

    const result = await ctx.renderMedia({type: `photo`, mode: `edit`, fallbackEdit: `delete-reply`})

    expect(api.deleteMessage).toHaveBeenCalledTimes(1)
    expect(api.sendPhoto).toHaveBeenCalledTimes(1)
    expect(result).toEqual({message_id: 2, date: 0, chat: {id: 1, type: `private`}} as any)
  })

  it(`disable: rethrows the edit error with no fallback`, async () => {
    const {ctx, api, editError} = createTestCtx()

    await expect(ctx.renderMedia({type: `photo`, mode: `edit`, fallbackEdit: `disable`})).rejects.toBe(editError)

    expect(api.deleteMessage).not.toHaveBeenCalled()
    expect(api.sendPhoto).not.toHaveBeenCalled()
  })
})
