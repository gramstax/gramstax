import {describe, expect, it, mock} from "bun:test"
import {Ctx} from "~/core/ctx"
import type {ITCtxParams} from "~/types/t.ctx"

// ── Test page class ────────────────────────────────────────────────

class TestPage extends Ctx {
  static data = this.buildData({name: `render-auto-media-test`})
}

// ── Ctx factory ────────────────────────────────────────────────────

function createTestCtx(hasCallbackQuery = false, editMessageMediaImpl?: () => unknown) {
  const editMessageMedia = mock(() => editMessageMediaImpl?.() ?? ({message_id: 1} as any))
  const api = {
    config: {use: () => {}},
    editMessageMedia,
    deleteMessage: mock(() => ({ok: true} as any)),
    sendMessage: mock(() => ({message_id: 2, date: 0, chat: {id: 1, type: `private` as const}} as any)),
    sendDocument: mock(() => ({message_id: 2} as any))
  }

  const ct = {
    api,
    me: {id: 1, is_bot: true, first_name: `Bot`} as any,
    update: hasCallbackQuery
      ? ({callback_query: {id: `999`, from: {id: 1, is_bot: false, first_name: `Test`}, message: {message_id: 1, chat: {id: 1, type: `private`}}, data: `test`}} as any)
      : ({message: {message_id: 1, chat: {id: 1, type: `private`}, text: `test`, from: {id: 1, is_bot: false, first_name: `Test`}}} as any)
  } as unknown as ITCtxParams[`ct`]

  const ctx = new TestPage({
    ct,
    cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {
      getGMessage: () => `hello`,
      getGMedia: () => ({src: `https://example.com/a.jpg`, caption: `hi`, filename: `a.jpg`})
    } as unknown as ITCtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })

  return {ctx, api}
}

// ── Tests ──────────────────────────────────────────────────────────

describe(`Ctx.render*Auto reply mode`, () => {
  it(`renderPhotoAuto forwards to renderAutoMedia`, async () => {
    const {ctx} = createTestCtx(false)
    const spy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.renderAutoMedia = spy as any
    await ctx.renderPhotoAuto()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(`photo`, undefined, undefined, undefined, undefined, undefined, `delete-reply`)
  })

  it(`renderVideoAuto forwards to renderAutoMedia`, async () => {
    const {ctx} = createTestCtx(false)
    const spy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.renderAutoMedia = spy as any
    await ctx.renderVideoAuto()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(`video`, undefined, undefined, undefined, undefined, undefined, `delete-reply`)
  })

  it(`renderAudioAuto forwards to renderAutoMedia`, async () => {
    const {ctx} = createTestCtx(false)
    const spy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.renderAutoMedia = spy as any
    await ctx.renderAudioAuto()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(`audio`, undefined, undefined, undefined, undefined, undefined, `delete-reply`)
  })

  it(`renderDocumentAuto forwards to renderAutoMedia`, async () => {
    const {ctx} = createTestCtx(false)
    const spy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.renderAutoMedia = spy as any
    await ctx.renderDocumentAuto()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(`document`, undefined, undefined, undefined, undefined, undefined, `delete-reply`)
  })

  it(`renderAnimationAuto forwards to renderAutoMedia`, async () => {
    const {ctx} = createTestCtx(false)
    const spy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.renderAutoMedia = spy as any
    await ctx.renderAnimationAuto()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(`animation`, undefined, undefined, undefined, undefined, undefined, `delete-reply`)
  })

  it(`renderVoiceAuto forwards to renderAutoMedia`, async () => {
    const {ctx} = createTestCtx(false)
    const spy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.renderAutoMedia = spy as any
    await ctx.renderVoiceAuto()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(`voice`, undefined, undefined, undefined, undefined, undefined, `delete-reply`)
  })

  it(`renderVideoNoteAuto forwards to renderAutoMedia`, async () => {
    const {ctx} = createTestCtx(false)
    const spy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.renderAutoMedia = spy as any
    await ctx.renderVideoNoteAuto()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(`video_note`, undefined, undefined, undefined, undefined, undefined, `delete-reply`)
  })

  it(`renderStickerAuto forwards to renderAutoMedia`, async () => {
    const {ctx} = createTestCtx(false)
    const spy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.renderAutoMedia = spy as any
    await ctx.renderStickerAuto()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(`sticker`, undefined, undefined, undefined, undefined, undefined, `delete-reply`)
  })

  it(`renderLocationAuto forwards to renderAutoMedia`, async () => {
    const {ctx} = createTestCtx(false)
    const spy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.renderAutoMedia = spy as any
    await ctx.renderLocationAuto()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(`location`, undefined, undefined, undefined, undefined, undefined, `delete-reply`)
  })

  it(`renderContactAuto forwards to renderAutoMedia`, async () => {
    const {ctx} = createTestCtx(false)
    const spy = mock(() => Promise.resolve({message_id: 1} as any))
    ctx.renderAutoMedia = spy as any
    await ctx.renderContactAuto()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(`contact`, undefined, undefined, undefined, undefined, undefined, `delete-reply`)
  })
})

describe(`Ctx.renderDocumentAuto edit mode`, () => {
  it(`forwards options2 to editMessageMedia with callbackQuery update`, async () => {
    const {ctx, api} = createTestCtx(true)
    await ctx.renderDocumentAuto(null, null, null, null, {business_connection_id: `bc-1`}, `reply`)
    expect(api.editMessageMedia).toHaveBeenCalledTimes(1)
    const rawCalls = api.editMessageMedia.mock.calls as any[][]
    expect(JSON.stringify(rawCalls[0])).toContain(`bc-1`)
    expect(api.deleteMessage).not.toHaveBeenCalled()
  })

  it(`keeps fallbackEdit disable behavior intact`, async () => {
    const editError = new Error(`cannot edit`)
    const {ctx} = createTestCtx(true, () => {
      throw editError
    })
    await expect(ctx.renderDocumentAuto(null, null, null, null, null, `disable`)).rejects.toBe(editError)
  })
})
