import {describe, expect, it, mock} from "bun:test"
import {GrammyError, HttpError} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ITInvoiceBlock} from "~/template/engine"
import type {ITCtxParams} from "~/types/t.ctx"

class InvoicePage extends Ctx {
  static data = Ctx.buildData({name: `invoicepage`})
}

const grammyError = (code: number) => new GrammyError(`Call failed!`, {error_code: code, description: `desc`, parameters: {}} as never, `sendInvoice`, {})

const httpError = () => new HttpError(`net down`, new Error(`socket`))

const starsInvoice: ITInvoiceBlock = {title: `VIP 30 hari`, description: `Akses semua konten`, payload: `o-1`, currency: `XTR`, prices: [{label: `VIP 30 hari`, amount: 100}]}

const fiatInvoice: ITInvoiceBlock = {title: `Pro plan`, description: `Monthly access`, payload: `o-2`, currency: `USD`, prices: [{label: `Pro`, amount: 499}]}

const makeApi = (overrides?: Record<string, unknown>) => ({
  config: {use: () => {}},
  sendInvoice: mock(async () => ({message_id: 7}) as never),
  answerPreCheckoutQuery: mock(async () => true as never),
  ...(overrides ?? {})
})

const messageUpdate = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

const noChatUpdate = {message: {message_id: 1, date: 1, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

const preCheckoutUpdate = {pre_checkout_query: {id: `q-1`, from: {id: 1, is_bot: false, first_name: `A`}, currency: `XTR`, total_amount: 100, invoice_payload: `o-1`}}

const makeCtx = (api: Record<string, unknown>, invoice: ITInvoiceBlock, extra?: {log?: unknown; onSendError?: unknown}, update: Record<string, unknown> = messageUpdate) => {
  const tm = {getGInvoice: mock(() => invoice)} as never
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ITCtxParams[`ct`]
  return new InvoicePage({
    ct,
    cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ITCtxParams[`templateManager`],
    log: (extra?.log ?? null) as unknown as ITCtxParams[`log`],
    onSendError: (extra?.onSendError ?? null) as unknown as ITCtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

describe(`invoice-render`, () => {
  it(`sends a stars invoice with no provider_token`, async () => {
    const api = makeApi()
    const kb = {inline_keyboard: []}
    await makeCtx(api, starsInvoice).renderInvoice(kb as never, {orderId: `o-1`})
    expect(api.sendInvoice).toHaveBeenCalledTimes(1)
    const args = (api.sendInvoice.mock.calls as any)[0]
    expect(args[0]).toBe(1)
    expect(args[1]).toBe(`VIP 30 hari`)
    expect(args[2]).toBe(`Akses semua konten`)
    expect(args[3]).toBe(`o-1`)
    expect(args[4]).toBe(`XTR`)
    expect(args[5]).toEqual([{label: `VIP 30 hari`, amount: 100}])
    expect(args[6]).toMatchObject({reply_markup: kb})
    expect(`provider_token` in (args[6] as Record<string, unknown>)).toBe(false)
  })

  it(`forwards interpolation data to getGInvoice`, async () => {
    const api = makeApi()
    const getGInvoice = mock(() => starsInvoice)
    const tm = {getGInvoice} as never
    const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update: messageUpdate} as unknown as ITCtxParams[`ct`]
    const ctx = new InvoicePage({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager: tm as ITCtxParams[`templateManager`],
      log: null as unknown as ITCtxParams[`log`],
      onSendError: null as unknown as ITCtxParams[`onSendError`],
      temp: {isAnswer: false, session: {}, data: {}}
    })
    await ctx.renderInvoice(null, {orderId: `o-1`}, `promo`)
    expect((getGInvoice.mock.calls as any)[0]).toEqual([`invoicepage`, `promo`, undefined, {orderId: `o-1`}])
  })

  it(`sends a fiat invoice with the provider_token from options`, async () => {
    const api = makeApi()
    await makeCtx(api, fiatInvoice).renderInvoice(null, {orderId: `o-2`}, null, {provider_token: `tok-live`} as never)
    expect(api.sendInvoice).toHaveBeenCalledTimes(1)
    const args = (api.sendInvoice.mock.calls as any)[0]
    expect(args[4]).toBe(`USD`)
    expect(args[6]).toMatchObject({provider_token: `tok-live`})
  })

  it(`throws before any api call when fiat has no provider_token`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, fiatInvoice).renderInvoice()).rejects.toThrow(/provider_token is required for fiat currency "USD".*never templates/)
    expect(api.sendInvoice).not.toHaveBeenCalled()
  })

  it(`throws before any api call when the title overflows`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...starsInvoice, title: `T`.repeat(33)}).renderInvoice()).rejects.toThrow(/1-32/)
    expect(api.sendInvoice).not.toHaveBeenCalled()
  })

  it(`throws before any api call when the description overflows`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...starsInvoice, description: `D`.repeat(256)}).renderInvoice()).rejects.toThrow(/1-255/)
    expect(api.sendInvoice).not.toHaveBeenCalled()
  })

  it(`throws before any api call when the payload overflows in bytes`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...starsInvoice, payload: `é`.repeat(65)}).renderInvoice()).rejects.toThrow(/1-128 bytes/)
    expect(api.sendInvoice).not.toHaveBeenCalled()
  })

  it(`throws before any api call when the currency is not a 3-letter code`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...starsInvoice, currency: `usd`}).renderInvoice()).rejects.toThrow(/3-letter code/)
    expect(api.sendInvoice).not.toHaveBeenCalled()
  })

  it(`throws before any api call when prices are empty`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...starsInvoice, prices: []}).renderInvoice()).rejects.toThrow(/at least 1 price/)
    expect(api.sendInvoice).not.toHaveBeenCalled()
  })

  it(`throws before any api call when a price label is empty`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...starsInvoice, prices: [{label: ``, amount: 100}]}).renderInvoice()).rejects.toThrow(/label must be non-empty/)
    expect(api.sendInvoice).not.toHaveBeenCalled()
  })

  it(`throws before any api call when a price amount is zero`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...starsInvoice, prices: [{label: `VIP`, amount: 0}]}).renderInvoice()).rejects.toThrow(/positive integer/)
    expect(api.sendInvoice).not.toHaveBeenCalled()
  })

  it(`throws before any api call when a price amount is not an integer`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...starsInvoice, prices: [{label: `VIP`, amount: 1.5}]}).renderInvoice()).rejects.toThrow(/positive integer/)
    expect(api.sendInvoice).not.toHaveBeenCalled()
  })

  it(`throws when no chat id is available`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, starsInvoice, undefined, noChatUpdate).renderInvoice()).rejects.toThrow(/chat id/)
    expect(api.sendInvoice).not.toHaveBeenCalled()
  })

  it(`notifies fallback-text with page kind chatId and rethrows the original 403 error`, async () => {
    const err = grammyError(403)
    const seen: Array<{err: unknown; info: unknown}> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendInvoice: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, starsInvoice, {log: {warn, error}, onSendError: (e: unknown, info: unknown) => {
        seen.push({err: e, info})
      }}).renderInvoice()
    ).rejects.toBe(err)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `invoicepage`, kind: `fallback-text`, chatId: 1})
    expect(warn).toHaveBeenCalledTimes(1)
    expect((warn.mock.calls as any)[0][0]).toContain(`invoicepage`)
    expect(error).not.toHaveBeenCalled()
  })

  it(`notifies retryable with error log and rethrows the original transport error`, async () => {
    const err = httpError()
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendInvoice: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, starsInvoice, {log: {warn, error}, onSendError: (_e: unknown, info: unknown) => {
        seen.push(info)
      }}).renderInvoice()
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `invoicepage`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
    const msg = (error.mock.calls as any)[0][0] as string
    expect(msg).toContain(`invoicepage`)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe(`invoice-precheckout`, () => {
  it(`approves the current pre-checkout query`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, starsInvoice, undefined, preCheckoutUpdate).answerPreCheckout(true)
    expect(result).toBe(true)
    expect(api.answerPreCheckoutQuery).toHaveBeenCalledTimes(1)
    expect((api.answerPreCheckoutQuery.mock.calls as any)[0]).toEqual([`q-1`, true])
  })

  it(`rejects with an error message`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, starsInvoice, undefined, preCheckoutUpdate).answerPreCheckout(false, `Stok habis`)
    expect(result).toBe(true)
    expect((api.answerPreCheckoutQuery.mock.calls as any)[0]).toEqual([`q-1`, false, {error_message: `Stok habis`}])
  })

  it(`rejects without an error message`, async () => {
    const api = makeApi()
    await makeCtx(api, starsInvoice, undefined, preCheckoutUpdate).answerPreCheckout(false)
    expect((api.answerPreCheckoutQuery.mock.calls as any)[0]).toEqual([`q-1`, false, {}])
  })

  it(`throws when no pre-checkout query is active`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, starsInvoice).answerPreCheckout(true)).rejects.toThrow(/pre_checkout_query/)
    expect(api.answerPreCheckoutQuery).not.toHaveBeenCalled()
  })
})
