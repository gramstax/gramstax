import {describe, expect, it, mock} from "bun:test"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

// ── Test page class ────────────────────────────────────────────────

class TestPage extends Ctx {
  static data = this.buildData({name: `render-auto-media-test`})
}

// ── Ctx factory ────────────────────────────────────────────────────

function createTestCtx(hasCallbackQuery = false, editMessageMediaImpl?: () => unknown, med?: Record<string, unknown>) {
  const editMessageMedia = mock(() => editMessageMediaImpl?.() ?? ({message_id: 1} as any))
  const api = {
    config: {use: () => {}},
    editMessageMedia,
    deleteMessage: mock(() => ({ok: true}) as any),
    sendMessage: mock(() => ({message_id: 2, date: 0, chat: {id: 1, type: `private` as const}}) as any),
    sendPhoto: mock(() => ({message_id: 2}) as any),
    sendVideo: mock(() => ({message_id: 2}) as any),
    sendAudio: mock(() => ({message_id: 2}) as any),
    sendDocument: mock(() => ({message_id: 2}) as any),
    sendAnimation: mock(() => ({message_id: 2}) as any),
    sendVoice: mock(() => ({message_id: 2}) as any),
    sendVideoNote: mock(() => ({message_id: 2}) as any),
    sendSticker: mock(() => ({message_id: 2}) as any),
    sendLocation: mock(() => ({message_id: 2}) as any),
    sendContact: mock(() => ({message_id: 2}) as any)
  }

  const ct = {
    api,
    me: {id: 1, is_bot: true, first_name: `Bot`} as any,
    update: hasCallbackQuery
      ? ({callback_query: {id: `999`, from: {id: 1, is_bot: false, first_name: `Test`}, message: {message_id: 1, chat: {id: 1, type: `private`}}, data: `test`}} as any)
      : ({message: {message_id: 1, chat: {id: 1, type: `private`}, text: `test`, from: {id: 1, is_bot: false, first_name: `Test`}}} as any)
  } as unknown as ICtxParams[`ct`]

  const ctx = new TestPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {
      getGMessage: () => ({kind: `message`, text: `hello`, rich: false}),
      getGMedia: () => med ?? ({src: `https://example.com/a.jpg`, caption: `hi`, filename: `a.jpg`} as Record<string, unknown>)
    } as unknown as ICtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })

  return {ctx, api}
}

// ── Tests ──────────────────────────────────────────────────────────

describe(`Ctx per-kind media wrappers reply mode`, () => {
  it(`renderPhoto sends a photo reply through the api`, async () => {
    const {ctx, api} = createTestCtx(false)
    await ctx.renderPhoto()
    expect(api.sendPhoto).toHaveBeenCalledTimes(1)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })

  it(`renderVideo sends a video reply through the api`, async () => {
    const {ctx, api} = createTestCtx(false)
    await ctx.renderVideo()
    expect(api.sendVideo).toHaveBeenCalledTimes(1)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })

  it(`renderAudio sends an audio reply through the api`, async () => {
    const {ctx, api} = createTestCtx(false)
    await ctx.renderAudio()
    expect(api.sendAudio).toHaveBeenCalledTimes(1)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })

  it(`renderDocument sends a document reply through the api`, async () => {
    const {ctx, api} = createTestCtx(false)
    await ctx.renderDocument()
    expect(api.sendDocument).toHaveBeenCalledTimes(1)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })

  it(`renderAnimation sends an animation reply through the api`, async () => {
    const {ctx, api} = createTestCtx(false)
    await ctx.renderAnimation()
    expect(api.sendAnimation).toHaveBeenCalledTimes(1)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })

  it(`renderVoice sends a voice reply through the api`, async () => {
    const {ctx, api} = createTestCtx(false, undefined, {type: `voice`, src: `https://example.com/a.ogg`})
    await ctx.renderVoice()
    expect(api.sendVoice).toHaveBeenCalledTimes(1)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })

  it(`renderVideoNote sends a video note reply through the api`, async () => {
    const {ctx, api} = createTestCtx(false, undefined, {type: `video_note`, src: `https://example.com/a.mp4`})
    await ctx.renderVideoNote()
    expect(api.sendVideoNote).toHaveBeenCalledTimes(1)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })

  it(`renderSticker sends a sticker reply through the api`, async () => {
    const {ctx, api} = createTestCtx(false, undefined, {type: `sticker`, src: `https://example.com/a.webp`})
    await ctx.renderSticker()
    expect(api.sendSticker).toHaveBeenCalledTimes(1)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })

  it(`renderLocation sends a location reply through the api`, async () => {
    const {ctx, api} = createTestCtx(false, undefined, {type: `location`, latitude: `1.5`, longitude: `2.5`})
    await ctx.renderLocation()
    expect(api.sendLocation).toHaveBeenCalledTimes(1)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })

  it(`renderContact sends a contact reply through the api`, async () => {
    const {ctx, api} = createTestCtx(false, undefined, {type: `contact`, phone: `+100`, first_name: `A`})
    await ctx.renderContact()
    expect(api.sendContact).toHaveBeenCalledTimes(1)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })
})

describe(`Ctx.renderDocument edit mode`, () => {
  it(`forwards mediaOptions to editMessageMedia with callbackQuery update`, async () => {
    const {ctx, api} = createTestCtx(true)
    await ctx.renderDocument({mediaOptions: {business_connection_id: `bc-1`}, fallback: `reply`})
    expect(api.editMessageMedia).toHaveBeenCalledTimes(1)
    const rawCalls = api.editMessageMedia.mock.calls as any[][]
    expect(JSON.stringify(rawCalls[0])).toContain(`bc-1`)
    expect(api.deleteMessage).not.toHaveBeenCalled()
  })

  it(`keeps fallback disable behavior intact`, async () => {
    const editError = new Error(`cannot edit`)
    const {ctx} = createTestCtx(true, () => {
      throw editError
    })
    await expect(ctx.renderDocument({fallback: `disable`})).rejects.toBe(editError)
  })
})
