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
    sendMessage: mock(() => ({message_id: 2, date: 0, chat: {id: 1, type: `private` as const}}) as any)
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
      getGMessage: () => `hello`,
      getGMedia: () => ({src: `https://example.com/a.jpg`, caption: `hi`})
    } as unknown as ICtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })

  return {ctx, api, editError}
}

// ── Tests ──────────────────────────────────────────────────────────

describe(`Ctx.renderEdit fallbackEdit modes`, () => {
  it(`default delete-reply: deletes the message, then renders a new reply`, async () => {
    const {ctx, api} = createTestCtx()
    const renderSpy = mock(() => Promise.resolve({message_id: 2} as any))
    ctx.render = renderSpy as any

    const result = await ctx.renderEdit(undefined, undefined, undefined, undefined)

    expect(api.deleteMessage).toHaveBeenCalledTimes(1)
    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(result).toEqual({message_id: 2} as any)
  })

  it(`delete-reply: still sends the reply when message deletion fails`, async () => {
    const {ctx, api} = createTestCtx()
    const renderSpy = mock(() => Promise.resolve({message_id: 2} as any))
    ctx.render = renderSpy as any
    api.deleteMessage.mockImplementation(() => {
      throw new Error(`message already deleted`)
    })

    const result = await ctx.renderEdit(undefined, undefined, undefined, undefined, `delete-reply`)

    expect(api.deleteMessage).toHaveBeenCalledTimes(1)
    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(result).toEqual({message_id: 2} as any)
  })

  it(`reply: renders a new reply without deleting the original`, async () => {
    const {ctx, api} = createTestCtx()
    const renderSpy = mock(() => Promise.resolve({message_id: 2} as any))
    ctx.render = renderSpy as any

    const result = await ctx.renderEdit(undefined, undefined, undefined, undefined, `reply`)

    expect(api.deleteMessage).not.toHaveBeenCalled()
    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(result).toEqual({message_id: 2} as any)
  })

  it(`disable: rethrows the edit error with no fallback`, async () => {
    const {ctx, api, editError} = createTestCtx()
    const renderSpy = mock(() => Promise.resolve({message_id: 2} as any))
    ctx.render = renderSpy as any

    await expect(ctx.renderEdit(undefined, undefined, undefined, undefined, `disable`)).rejects.toBe(editError)

    expect(api.deleteMessage).not.toHaveBeenCalled()
    expect(renderSpy).not.toHaveBeenCalled()
  })
})

describe(`Ctx.renderEditMedia fallbackEdit modes`, () => {
  it(`delete-reply: deletes the message, then re-sends the same media type`, async () => {
    const {ctx, api} = createTestCtx()
    const renderMediaSpy = mock(() => Promise.resolve({message_id: 2} as any))
    ctx.renderMedia = renderMediaSpy as any

    const result = await ctx.renderEditMedia(`photo`, undefined, undefined, undefined, undefined, undefined, `delete-reply`)

    expect(api.deleteMessage).toHaveBeenCalledTimes(1)
    expect(renderMediaSpy).toHaveBeenCalledWith(`photo`, undefined, undefined, undefined)
    expect(result).toEqual({message_id: 2} as any)
  })

  it(`disable: rethrows the edit error with no fallback`, async () => {
    const {ctx, api, editError} = createTestCtx()
    const renderMediaSpy = mock(() => Promise.resolve({message_id: 2} as any))
    ctx.renderMedia = renderMediaSpy as any

    await expect(ctx.renderEditMedia(`photo`, undefined, undefined, undefined, undefined, undefined, `disable`)).rejects.toBe(editError)

    expect(api.deleteMessage).not.toHaveBeenCalled()
    expect(renderMediaSpy).not.toHaveBeenCalled()
  })
})
