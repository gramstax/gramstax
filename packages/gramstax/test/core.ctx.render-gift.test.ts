import {describe, expect, it, mock} from "bun:test"
import {GrammyError} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

// ── Test page class ──────────────────────────────────────────────────

class GiftPage extends Ctx {
  static data = this.buildData({name: `render-gift-test`})
}

// ── Ctx factory ──────────────────────────────────────────────────────

function createTestCtx(extra?: {onSendError?: unknown}) {
  const api = {
    config: {use: () => {}},
    sendGift: mock(async () => true as any),
    sendMessage: mock(async () => ({message_id: 2, date: 0, chat: {id: 1, type: `private` as const}}) as any)
  }

  const ct = {
    api,
    me: {id: 1, is_bot: true, first_name: `Bot`} as any,
    update: {message: {message_id: 1, chat: {id: 1, type: `private`}, text: `test`, from: {id: 1, is_bot: false, first_name: `Test`}}} as any
  } as unknown as ICtxParams[`ct`]

  const ctx = new GiftPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {
      getGGift: () => `gift card hello`
    } as unknown as ICtxParams[`templateManager`],
    onSendError: (extra?.onSendError ?? null) as unknown as ICtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })

  return {ctx, api}
}

// ── Tests ────────────────────────────────────────────────────────────

describe(`Ctx.renderGift`, () => {
  it(`sends the gift with the gift id and the template card text`, async () => {
    const {ctx, api} = createTestCtx()
    const result = await ctx.renderGift(42, `gift-1`, undefined, undefined, `gift-card`)
    expect(result).toBe(true)
    expect(api.sendGift).toHaveBeenCalledTimes(1)
    const [target, giftId, extra] = (api.sendGift.mock.calls as any[])[0] as [number, string, Record<string, unknown>]
    expect(target).toBe(42)
    expect(giftId).toBe(`gift-1`)
    expect(extra).toMatchObject({text: `gift card hello`, text_parse_mode: `HTML`})
  })

  it(`insufficient Stars balance throws after notify and never sends plain text`, async () => {
    const err = new GrammyError(`Bad Request: not enough stars`, {error_code: 400, description: `Bad Request: not enough stars`, parameters: {}} as never, `sendGift`, {})
    const seen: Array<{err: unknown; info: unknown}> = []
    const {ctx, api} = createTestCtx({
      onSendError: (e: unknown, info: unknown) => {
        seen.push({err: e, info})
      }
    })
    api.sendGift.mockImplementation(async () => {
      throw err
    })
    await expect(ctx.renderGift(42, `gift-1`, undefined, undefined, `gift-card`)).rejects.toBe(err)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `render-gift-test`, kind: `fallback-text`, chatId: 42})
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it(`non-null keyboard throws before any API call`, async () => {
    const {ctx, api} = createTestCtx()
    await expect(ctx.renderGift(42, `gift-1`, {inline_keyboard: []} as any, undefined, `gift-card`)).rejects.toThrow(`no reply markup`)
    expect(api.sendGift).not.toHaveBeenCalled()
    expect(api.sendMessage).not.toHaveBeenCalled()
  })
})
