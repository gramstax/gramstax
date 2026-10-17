import {describe, expect, it, mock} from "bun:test"
import {GrammyError} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

// ── Test page class ──────────────────────────────────────────────────

class CallbackPaymentPage extends Ctx {
  static data = this.buildData({name: `callback-payment-test`})
}

// ── Helpers ──────────────────────────────────────────────────────────

const from = {id: 1, is_bot: false, first_name: `A`}

const callbackUpdate = {callback_query: {id: `cq1`, from, data: `buy`, message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`}}}
const preCheckoutUpdate = {pre_checkout_query: {id: `pq1`, from, currency: `XTR`, total_amount: 5, invoice_payload: `payload`}}
const shippingUpdate = {shipping_query: {id: `sq1`, from, invoice_payload: `payload`, shipping_address: {country_code: `ID`, state: ``, city: `JKT`, street_line1: `Jl`, street_line2: ``, post_code: `1`}}}

function createCtx(api: Record<string, unknown>, update: unknown, text = `hello`) {
  const ct = {
    api,
    me: {id: 9, is_bot: true, first_name: `Bot`} as any,
    update: update as any
  } as unknown as ICtxParams[`ct`]
  return new CallbackPaymentPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {getGCallbackAnswer: () => ({kind: `callbackAnswer`, text}), getGPrecheckoutError: () => ({kind: `preCheckoutError`, text}), getGShippingError: () => ({kind: `shippingError`, text}), getGKeyboard: () => ({kind: `keyboard`, rows: []})} as unknown as ICtxParams[`templateManager`],
    onSendError: null as unknown as ICtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

function makeApi() {
  return {
    config: {use: () => {}},
    answerCallbackQuery: mock(async () => true as any),
    answerPreCheckoutQuery: mock(async () => true as any),
    answerShippingQuery: mock(async () => true as any)
  }
}

// ── renderCallbackAnswer ─────────────────────────────────────────────

describe(`Ctx.renderCallbackAnswer`, () => {
  it(`answers with block text and show_alert flag`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, callbackUpdate, `tapped!`)
    await ctx.renderCallbackAnswer({showAlert: true, AGBaseId: `tap-card`})
    expect(api.answerCallbackQuery).toHaveBeenCalledTimes(1)
    const [id, extra] = (api.answerCallbackQuery.mock.calls as any[])[0] as [string, Record<string, unknown>]
    expect(id).toBe(`cq1`)
    expect(extra.text).toBe(`tapped!`)
    expect(extra.show_alert).toBe(true)
  })

  it(`merges object options after defaults`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, callbackUpdate, `tap`)
    await ctx.renderCallbackAnswer({showAlert: false, AGBaseId: `tap-card`, options: {cache_time: 10} as any})
    const [, extra] = (api.answerCallbackQuery.mock.calls as any[])[0] as [string, Record<string, unknown>]
    expect(extra.show_alert).toBe(false)
    expect(extra.cache_time).toBe(10)
  })

  it(`rethrows after notify on send failure`, async () => {
    const err = new GrammyError(`Bad Request: query is too old`, {error_code: 400, description: `Bad Request: query is too old`, parameters: {}} as never, `answerCallbackQuery`, {})
    const api = makeApi()
    api.answerCallbackQuery = mock(async () => {
      throw err
    })
    const seen: unknown[] = []
    const ct = {
      api,
      me: {id: 9, is_bot: true, first_name: `Bot`} as any,
      update: callbackUpdate as any
    } as unknown as ICtxParams[`ct`]
    const ctx = new CallbackPaymentPage({
      ct,
      cacheSession: {} as unknown as ICtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager: {getGCallbackAnswer: () => ({kind: `callbackAnswer`, text: `tap`}), getGPrecheckoutError: () => ({kind: `preCheckoutError`, text: `tap`}), getGShippingError: () => ({kind: `shippingError`, text: `tap`}), getGKeyboard: () => ({kind: `keyboard`, rows: []})} as unknown as ICtxParams[`templateManager`],
      onSendError: ((e: unknown) => seen.push(e)) as unknown as ICtxParams[`onSendError`],
      temp: {isAnswer: false, session: {}, data: {}}
    })
    await expect(ctx.renderCallbackAnswer({showAlert: false, AGBaseId: `tap-card`})).rejects.toThrow(err)
    expect(seen.length).toBe(1)
  })
})

// ── renderPreCheckout ────────────────────────────────────────────────

describe(`Ctx.renderPreCheckout`, () => {
  it(`answers ok=true with no error_message`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, preCheckoutUpdate, `unused`)
    await ctx.renderPreCheckout({ok: true, AGBaseId: `pay-card`})
    expect(api.answerPreCheckoutQuery).toHaveBeenCalledTimes(1)
    const [id, ok, extra] = (api.answerPreCheckoutQuery.mock.calls as any[])[0] as [string, boolean, Record<string, unknown>]
    expect(id).toBe(`pq1`)
    expect(ok).toBe(true)
    expect(extra?.error_message).toBeUndefined()
  })

  it(`answers ok=false with block text as error_message`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, preCheckoutUpdate, `stok habis`)
    await ctx.renderPreCheckout({ok: false, AGBaseId: `pay-card`})
    const [id, ok, extra] = (api.answerPreCheckoutQuery.mock.calls as any[])[0] as [string, boolean, Record<string, unknown>]
    expect(id).toBe(`pq1`)
    expect(ok).toBe(false)
    expect(extra.error_message).toBe(`stok habis`)
  })

  it(`string options override the error_message`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, preCheckoutUpdate, `block text`)
    await ctx.renderPreCheckout({ok: false, AGBaseId: `pay-card`, options: `custom error` as any})
    const [, , extra] = (api.answerPreCheckoutQuery.mock.calls as any[])[0] as [string, boolean, Record<string, unknown>]
    expect(extra.error_message).toBe(`custom error`)
  })
})

// ── renderShipping ───────────────────────────────────────────────────

describe(`Ctx.renderShipping`, () => {
  it(`answers ok=true with no error_message`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, shippingUpdate, `unused`)
    await ctx.renderShipping({ok: true, AGBaseId: `ship-card`})
    expect(api.answerShippingQuery).toHaveBeenCalledTimes(1)
    const [id, ok, extra] = (api.answerShippingQuery.mock.calls as any[])[0] as [string, boolean, Record<string, unknown>]
    expect(id).toBe(`sq1`)
    expect(ok).toBe(true)
    expect(extra?.error_message).toBeUndefined()
  })

  it(`answers ok=false with block text as error_message`, async () => {
    const api = makeApi()
    const ctx = createCtx(api, shippingUpdate, `di luar zona`)
    await ctx.renderShipping({ok: false, AGBaseId: `ship-card`})
    const [id, ok, extra] = (api.answerShippingQuery.mock.calls as any[])[0] as [string, boolean, Record<string, unknown>]
    expect(id).toBe(`sq1`)
    expect(ok).toBe(false)
    expect(extra.error_message).toBe(`di luar zona`)
  })
})
