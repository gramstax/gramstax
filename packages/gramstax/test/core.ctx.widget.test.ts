import {describe, expect, it, mock} from "bun:test"
import {GrammyError, HttpError} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"
import type {IWidgetBlock} from "~/types/template"

class WidgetPage extends Ctx {
  static data = Ctx.buildData({name: `widgetpage`})
}

const grammyError = (code: number) => new GrammyError(`Call failed!`, {error_code: code, description: `desc`, parameters: {}} as never, `sendWidget`, {})

const httpError = () => new HttpError(`net down`, new Error(`socket`))

const regularWidget: IWidgetBlock = {
  html: `<div class="card"><button>Tap me</button></div>`,
  caption: `Order <b>#1042</b>`,
  allow_queries: true,
  chat_data: `{"order": "1042"}`,
  width: 400,
  height: 300
}

const sharedWidget: IWidgetBlock = {
  html: `<div>Shared widget</div>`,
  caption: `Rate us`,
  is_shared: true,
  public_data: `{"poll": "stars"}`
}

// Same content as sharedWidget but WITHOUT is_shared: the edit /
// update-data routes must detect shared-ness from the update, never from
// the template flag — so shared-path tests use this fixture.
const sharedWidgetNoFlag: IWidgetBlock = {
  html: `<div>Shared widget</div>`,
  caption: `Rate us`,
  public_data: `{"poll": "stars"}`
}

const makeApi = (overrides?: Record<string, unknown>) => ({
  config: {use: () => {}},
  sendWidget: mock(async () => ({message_id: 7, widget: {id: `w-1`}}) as never),
  sendMessage: mock(async () => ({message_id: 8}) as never),
  answerWidgetQuery: mock(async () => true as never),
  editMessageWidgetData: mock(async () => true as never),
  editSharedWidgetData: mock(async () => true as never),
  editMessageCaption: mock(async () => true as never),
  editMessageReplyMarkup: mock(async () => true as never),
  ...(overrides ?? {})
})

const messageUpdate = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

const widgetQueryUpdate = {
  widget_query: {
    id: `q1`,
    from: {id: 1, is_bot: false, first_name: `A`},
    chat: {id: 1, type: `private`},
    message_id: 5,
    chat_instance: `ci`,
    type: {type: `data`},
    widget_id: `w-9`,
    data: `tap`
  }
}

const sharedWidgetQueryUpdate = {
  shared_widget_query: {
    id: `sq1`,
    from: {id: 1, is_bot: false, first_name: `A`},
    type: {type: `data`},
    data: `tap`,
    widget_id: `w-9`
  }
}

// Same tap as widgetQueryUpdate but from a REGULAR widget: no widget_id
// (per @grammyjs/types, widget_id is omitted when the widget isn't shared).
const regularWidgetQueryUpdate = {
  widget_query: {
    id: `q1`,
    from: {id: 1, is_bot: false, first_name: `A`},
    chat: {id: 1, type: `private`},
    message_id: 5,
    chat_instance: `ci`,
    type: {type: `data`},
    data: `tap`
  }
}

// Keyboard button under a shared widget message: the update is a
// callbackQuery whose message carries widget.id.
const callbackQueryUpdate = {
  callback_query: {
    id: `c1`,
    from: {id: 1, is_bot: false, first_name: `A`},
    chat_instance: `ci`,
    data: `btn`,
    message: {message_id: 5, date: 1, chat: {id: 1, type: `private`}, widget: {id: `w-9`, html: `<div>Shared widget</div>`}, from: {id: 9, is_bot: true, first_name: `Bot`}}
  }
}

const makeCtx = (api: Record<string, unknown>, widget: IWidgetBlock, extra?: {log?: unknown; onSendError?: unknown; answerText?: string}, update: Record<string, unknown> = messageUpdate) => {
  const tm = {getGWidget: mock(() => widget), getGWidgetAnswer: mock(() => ({kind: `widgetAnswer`, text: extra?.answerText ?? `ok`}))} as never
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ICtxParams[`ct`]
  return new WidgetPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ICtxParams[`templateManager`],
    log: (extra?.log ?? null) as unknown as ICtxParams[`log`],
    onSendError: (extra?.onSendError ?? null) as unknown as ICtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

describe(`widget-render`, () => {
  it(`sends a widget with caption, parse mode and template fields`, async () => {
    const api = makeApi()
    const kb = {inline_keyboard: []}
    await makeCtx(api, regularWidget).renderWidget({keyboard: kb as never})
    expect(api.sendWidget).toHaveBeenCalledTimes(1)
    const args = (api.sendWidget.mock.calls as any)[0]
    expect(args[0]).toBe(1)
    expect(args[1]).toBe(regularWidget.html)
    expect(args[2]).toMatchObject({caption: `Order <b>#1042</b>`, parse_mode: `HTML`, chat_data: `{"order": "1042"}`, allow_queries: true, width: 400, height: 300, reply_markup: kb})
  })

  it(`spreads options last over the template fields`, async () => {
    const api = makeApi()
    await makeCtx(api, regularWidget).renderWidget({options: {width: 200, caption: `Overridden`} as never})
    const args = (api.sendWidget.mock.calls as any)[0]
    expect(args[2]).toMatchObject({width: 200, caption: `Overridden`})
  })

  it(`throws before any api call when the HTML overflows raw`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...regularWidget, html: `x`.repeat(32769)}).renderWidget()).rejects.toThrow(/32768/)
    expect(api.sendWidget).not.toHaveBeenCalled()
  })

  it(`throws before any api call when the caption is missing`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...regularWidget, caption: ``}).renderWidget()).rejects.toThrow(/1-1024/)
    expect(api.sendWidget).not.toHaveBeenCalled()
  })

  it(`throws before any api call when chat_data overflows`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...regularWidget, chat_data: `x`.repeat(1025)}).renderWidget()).rejects.toThrow(/1024/)
    expect(api.sendWidget).not.toHaveBeenCalled()
  })

  it(`throws before any api call when width is out of range`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, {...regularWidget, width: 100}).renderWidget()).rejects.toThrow(/200-600/)
    expect(api.sendWidget).not.toHaveBeenCalled()
  })

  it(`falls back to sending the caption as text on a 400 error (DEFAULT, not rethrow)`, async () => {
    const err = grammyError(400)
    const seen: Array<{err: unknown; info: unknown}> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendWidget: mock(async () => {
        throw err
      })
    })
    const result = await makeCtx(api, regularWidget, {
      log: {warn, error},
      onSendError: (e: unknown, info: unknown) => {
        seen.push({err: e, info})
      }
    }).renderWidget()
    expect(api.sendWidget).toHaveBeenCalledTimes(1)
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    const args = (api.sendMessage.mock.calls as any)[0]
    expect(args[0]).toBe(1)
    expect(args[1]).toBe(`Order <b>#1042</b>`)
    expect(args[2]).toMatchObject({parse_mode: `HTML`})
    expect(result).toEqual(expect.objectContaining({message_id: 8}))
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `widgetpage`, kind: `fallback-text`, chatId: 1})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })

  it(`returns undefined when the fallback caption send also fails`, async () => {
    const api = makeApi({
      sendWidget: mock(async () => {
        throw grammyError(400)
      }),
      sendMessage: mock(async () => {
        throw grammyError(403)
      })
    })
    const result = await makeCtx(api, regularWidget).renderWidget()
    expect(result).toBeUndefined()
  })

  it(`notifies retryable with error log and rethrows the original transport error`, async () => {
    const err = httpError()
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendWidget: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, regularWidget, {
        log: {warn, error},
        onSendError: (_e: unknown, info: unknown) => {
          seen.push(info)
        }
      }).renderWidget()
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `widgetpage`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it(`throws for an unknown mode`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, regularWidget).renderWidget({mode: `auto`} as never)).rejects.toThrow(/unknown mode/)
    expect(api.sendWidget).not.toHaveBeenCalled()
  })
})

describe(`widget-edit`, () => {
  it(`re-applies chat_data, caption and keyboard to the held message (3 calls, returns true)`, async () => {
    const api = makeApi()
    const kb = {inline_keyboard: []}
    const result = await makeCtx(api, regularWidget).renderWidget({mode: `edit`, keyboard: kb as never})
    expect(result).toBe(true)
    expect(api.editMessageWidgetData).toHaveBeenCalledTimes(1)
    expect((api.editMessageWidgetData.mock.calls as any)[0]).toEqual([1, 1, {chat_data: `{"order": "1042"}`}])
    expect(api.editMessageCaption).toHaveBeenCalledTimes(1)
    expect((api.editMessageCaption.mock.calls as any)[0]).toEqual([1, 1, {caption: `Order <b>#1042</b>`, parse_mode: `HTML`}])
    expect(api.editMessageReplyMarkup).toHaveBeenCalledTimes(1)
    expect((api.editMessageReplyMarkup.mock.calls as any)[0]).toEqual([1, 1, {reply_markup: kb}])
    expect(api.sendWidget).not.toHaveBeenCalled()
  })

  it(`skips the keyboard call when no keyboard is passed`, async () => {
    const api = makeApi()
    await makeCtx(api, regularWidget).renderWidget({mode: `edit`})
    expect(api.editMessageReplyMarkup).not.toHaveBeenCalled()
    expect(api.editMessageWidgetData).toHaveBeenCalledTimes(1)
    expect(api.editMessageCaption).toHaveBeenCalledTimes(1)
  })

  it(`rejects a bottom keyboard on the edit route`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, regularWidget).renderWidget({mode: `edit`, keyboard: {keyboard: []} as never})).rejects.toThrow(/rejects a bottom/)
    expect(api.editMessageWidgetData).not.toHaveBeenCalled()
  })

  it(`edits a shared widget via editSharedWidgetData when the widget_query carries widget_id (no template is_shared needed)`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, sharedWidgetNoFlag, undefined, widgetQueryUpdate).renderWidget({mode: `edit`})
    expect(result).toBe(true)
    expect(api.editSharedWidgetData).toHaveBeenCalledTimes(1)
    expect((api.editSharedWidgetData.mock.calls as any)[0]).toEqual([`w-9`, `{"poll": "stars"}`])
    expect(api.editMessageWidgetData).not.toHaveBeenCalled()
    expect(api.editMessageCaption).toHaveBeenCalledTimes(1)
  })

  it(`edits a shared widget via editSharedWidgetData when the held message carries widget.id (callbackQuery)`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, sharedWidgetNoFlag, undefined, callbackQueryUpdate).renderWidget({mode: `edit`})
    expect(result).toBe(true)
    expect(api.editSharedWidgetData).toHaveBeenCalledTimes(1)
    expect((api.editSharedWidgetData.mock.calls as any)[0]).toEqual([`w-9`, `{"poll": "stars"}`])
    expect(api.editMessageWidgetData).not.toHaveBeenCalled()
    expect(api.editMessageCaption).toHaveBeenCalledTimes(1)
    expect((api.editMessageCaption.mock.calls as any)[0]).toEqual([1, 5, {caption: `Rate us`, parse_mode: `HTML`}])
  })

  it(`ignores the template is_shared flag on edit when the update carries no shared signal`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, sharedWidget).renderWidget({mode: `edit`})
    expect(result).toBe(true)
    expect(api.editSharedWidgetData).not.toHaveBeenCalled()
    expect(api.editMessageWidgetData).not.toHaveBeenCalled()
    expect(api.editMessageCaption).toHaveBeenCalledTimes(1)
  })
})

describe(`widget-update-data`, () => {
  it(`updates a regular widget with one editMessageWidgetData call`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, regularWidget).renderWidget({mode: `update-data`})
    expect(result).toBe(true)
    expect(api.editMessageWidgetData).toHaveBeenCalledTimes(1)
    expect((api.editMessageWidgetData.mock.calls as any)[0]).toEqual([1, 1, {chat_data: `{"order": "1042"}`}])
    expect(api.editMessageCaption).not.toHaveBeenCalled()
    expect(api.editMessageReplyMarkup).not.toHaveBeenCalled()
    expect(api.sendWidget).not.toHaveBeenCalled()
  })

  it(`updates a regular widget from a widget_query tap via widgetQuery.chat / message_id`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, regularWidget, undefined, regularWidgetQueryUpdate).renderWidget({mode: `update-data`})
    expect(result).toBe(true)
    expect(api.editMessageWidgetData).toHaveBeenCalledTimes(1)
    expect((api.editMessageWidgetData.mock.calls as any)[0]).toEqual([1, 5, {chat_data: `{"order": "1042"}`}])
  })

  it(`sends a new widget from a widget_query tap via replyWithWidget`, async () => {
    const api = makeApi()
    await makeCtx(api, regularWidget, undefined, regularWidgetQueryUpdate).renderWidget()
    expect(api.sendWidget).toHaveBeenCalledTimes(1)
    expect((api.sendWidget.mock.calls as any)[0][0]).toBe(1)
    expect((api.sendWidget.mock.calls as any)[0][1]).toBe(regularWidget.html)
  })

  it(`updates a shared widget with one editSharedWidgetData call from a widget_query carrying widget_id (no template is_shared needed)`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, sharedWidgetNoFlag, undefined, widgetQueryUpdate).renderWidget({mode: `update-data`})
    expect(result).toBe(true)
    expect(api.editSharedWidgetData).toHaveBeenCalledTimes(1)
    expect((api.editSharedWidgetData.mock.calls as any)[0]).toEqual([`w-9`, `{"poll": "stars"}`])
    expect(api.editMessageWidgetData).not.toHaveBeenCalled()
  })

  it(`updates a shared widget with one editSharedWidgetData call from a shared_widget_query`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, sharedWidgetNoFlag, undefined, sharedWidgetQueryUpdate).renderWidget({mode: `update-data`})
    expect(result).toBe(true)
    expect(api.editSharedWidgetData).toHaveBeenCalledTimes(1)
    expect((api.editSharedWidgetData.mock.calls as any)[0]).toEqual([`w-9`, `{"poll": "stars"}`])
    expect(api.editMessageWidgetData).not.toHaveBeenCalled()
  })

  it(`updates a shared widget with one editSharedWidgetData call from a callbackQuery on its message`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, sharedWidgetNoFlag, undefined, callbackQueryUpdate).renderWidget({mode: `update-data`})
    expect(result).toBe(true)
    expect(api.editSharedWidgetData).toHaveBeenCalledTimes(1)
    expect((api.editSharedWidgetData.mock.calls as any)[0]).toEqual([`w-9`, `{"poll": "stars"}`])
    expect(api.editMessageWidgetData).not.toHaveBeenCalled()
  })

  it(`ignores the template is_shared flag on update-data when the update carries no shared signal`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, sharedWidget).renderWidget({mode: `update-data`})).rejects.toThrow(/requires chat_data/)
    expect(api.editSharedWidgetData).not.toHaveBeenCalled()
    expect(api.editMessageWidgetData).not.toHaveBeenCalled()
  })

  it(`throws when update-data has no chat_data`, async () => {
    const api = makeApi()
    const {chat_data: _ignored, ...noData} = regularWidget
    await expect(makeCtx(api, noData).renderWidget({mode: `update-data`})).rejects.toThrow(/requires chat_data/)
    expect(api.editMessageWidgetData).not.toHaveBeenCalled()
  })

  it(`throws when update-data on a shared widget has no public_data`, async () => {
    const api = makeApi()
    const {public_data: _ignored, ...noData} = sharedWidgetNoFlag
    await expect(makeCtx(api, noData, undefined, widgetQueryUpdate).renderWidget({mode: `update-data`})).rejects.toThrow(/requires public_data/)
    expect(api.editSharedWidgetData).not.toHaveBeenCalled()
  })
})

describe(`widget-broadcast`, () => {
  it(`sends to every recipient with its own language widget`, async () => {
    const api = makeApi()
    const en: IWidgetBlock = {...regularWidget}
    const id: IWidgetBlock = {...regularWidget, caption: `Pesanan <b>#1042</b>`}
    const tm = {getGWidget: mock((_key: string, _base: string | undefined, lang: string) => (lang === `id` ? id : en))} as never
    const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update: messageUpdate} as unknown as ICtxParams[`ct`]
    const ctx = new WidgetPage({
      ct,
      cacheSession: {} as unknown as ICtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager: tm as ICtxParams[`templateManager`],
      log: null as unknown as ICtxParams[`log`],
      onSendError: null as unknown as ICtxParams[`onSendError`],
      temp: {isAnswer: false, session: {}, data: {}}
    })
    const result = await ctx.renderWidget({broadcast: {ids: [11, 12], languageCode: [`en`, `id`]}})
    expect(result).toEqual({successCount: 2, failedCount: 0, totalCount: 2, skippedCount: 0, retryable: []})
    expect(api.sendWidget).toHaveBeenCalledTimes(2)
    expect((api.sendWidget.mock.calls as any)[0][0]).toBe(11)
    expect((api.sendWidget.mock.calls as any)[0][2]).toMatchObject({caption: `Order <b>#1042</b>`})
    expect((api.sendWidget.mock.calls as any)[1][0]).toBe(12)
    expect((api.sendWidget.mock.calls as any)[1][2]).toMatchObject({caption: `Pesanan <b>#1042</b>`})
  })

  it(`counts a per-recipient fallback-text failure and sends that recipient the caption`, async () => {
    const api = makeApi({
      sendWidget: mock(async (id: number) => {
        if (id === 12) throw grammyError(400)
        return {message_id: 7} as never
      })
    })
    const result = await makeCtx(api, regularWidget).renderWidget({broadcast: {ids: [11, 12], languageCode: [`en`, `en`]}})
    expect(result).toEqual({successCount: 1, failedCount: 1, totalCount: 2, skippedCount: 0, retryable: []})
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect((api.sendMessage.mock.calls as any)[0][0]).toBe(12)
    expect((api.sendMessage.mock.calls as any)[0][1]).toBe(`Order <b>#1042</b>`)
  })

  it(`data-updates stored widget messages via broadcast.targets`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, regularWidget).renderWidget({
      broadcast: {
        targets: [
          {chatId: 11, messageId: 21},
          {chatId: 12, messageId: 22}
        ]
      }
    })
    expect(result).toEqual({successCount: 2, failedCount: 0, totalCount: 2, skippedCount: 0, retryable: []})
    expect(api.editMessageWidgetData).toHaveBeenCalledTimes(2)
    expect((api.editMessageWidgetData.mock.calls as any)[0]).toEqual([11, 21, {chat_data: `{"order": "1042"}`}])
    expect((api.editMessageWidgetData.mock.calls as any)[1]).toEqual([12, 22, {chat_data: `{"order": "1042"}`}])
  })

  it(`rejects broadcast.targets for a shared widget before any api call`, async () => {
    const api = makeApi()
    await expect(makeCtx(api, sharedWidget).renderWidget({broadcast: {targets: [{chatId: 11, messageId: 21}]}})).rejects.toThrow(/editSharedWidgetData/)
    expect(api.editMessageWidgetData).not.toHaveBeenCalled()
  })

  it(`rejects broadcast.targets when chat_data is missing`, async () => {
    const api = makeApi()
    const {chat_data: _ignored, ...noData} = regularWidget
    await expect(makeCtx(api, noData).renderWidget({broadcast: {targets: [{chatId: 11, messageId: 21}]}})).rejects.toThrow(/requires chat_data/)
    expect(api.editMessageWidgetData).not.toHaveBeenCalled()
  })
})

describe(`widget-route-guard`, () => {
  it(`rejects broadcast.targets combined with mode`, () => {
    expect(() => Ctx._assertRenderWidgetRoute({broadcast: {targets: []}, mode: `edit`})).toThrow(/broadcast\.targets \+ mode/)
  })

  it(`rejects broadcast-send combined with chunkSize`, () => {
    expect(() => Ctx._assertRenderWidgetRoute({broadcast: {ids: [1]}, chunkSize: 5})).toThrow(/broadcast \+ chunkSize/)
  })

  it(`rejects mode reply combined with chunkSize`, () => {
    expect(() => Ctx._assertRenderWidgetRoute({mode: `reply`, chunkSize: 5})).toThrow(/mode: "reply" \+ chunkSize/)
  })

  it(`rejects mode edit combined with options`, () => {
    expect(() => Ctx._assertRenderWidgetRoute({mode: `edit`, options: {width: 200}})).toThrow(/mode: "edit" \+ options/)
  })

  it(`rejects mode update-data combined with keyboard`, () => {
    expect(() => Ctx._assertRenderWidgetRoute({mode: `update-data`, keyboard: {inline_keyboard: []}})).toThrow(/mode: "update-data" \+ keyboard/)
  })

  it(`accepts the legal combinations`, () => {
    expect(() => Ctx._assertRenderWidgetRoute({})).not.toThrow()
    expect(() => Ctx._assertRenderWidgetRoute({mode: `reply`, keyboard: {inline_keyboard: []}})).not.toThrow()
    expect(() => Ctx._assertRenderWidgetRoute({mode: `edit`, keyboard: {inline_keyboard: []}})).not.toThrow()
    expect(() => Ctx._assertRenderWidgetRoute({mode: `update-data`})).not.toThrow()
    expect(() => Ctx._assertRenderWidgetRoute({broadcast: {ids: [1]}})).not.toThrow()
    expect(() => Ctx._assertRenderWidgetRoute({broadcast: {targets: []}})).not.toThrow()
  })
})

describe(`widget-answer`, () => {
  it(`answers a widget_query with the block text and returns true`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, regularWidget, {answerText: `ok 1042`}, widgetQueryUpdate).renderWidgetAnswer({AGBaseId: `rate-ack`})
    expect(result).toBe(true)
    expect(api.answerWidgetQuery).toHaveBeenCalledTimes(1)
    expect((api.answerWidgetQuery.mock.calls as any)[0]).toEqual([`q1`, {data: `ok 1042`}])
  })

  it(`answers a shared_widget_query with the same method (id resolved from either update)`, async () => {
    const api = makeApi()
    const result = await makeCtx(api, sharedWidget, {answerText: `shared-ok`}, sharedWidgetQueryUpdate).renderWidgetAnswer()
    expect(result).toBe(true)
    expect(api.answerWidgetQuery).toHaveBeenCalledTimes(1)
    expect((api.answerWidgetQuery.mock.calls as any)[0]).toEqual([`sq1`, {data: `shared-ok`}])
  })

  it(`rethrows a 400 error after notify+warn (no fallback)`, async () => {
    const err = grammyError(400)
    const seen: Array<{err: unknown; info: unknown}> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      answerWidgetQuery: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(
        api,
        regularWidget,
        {
          log: {warn, error},
          onSendError: (e: unknown, info: unknown) => {
            seen.push({err: e, info})
          }
        },
        widgetQueryUpdate
      ).renderWidgetAnswer()
    ).rejects.toBe(err)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `widgetpage`, kind: `fallback-text`, chatId: 1})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })

  it(`rethrows a retryable transport error after notify+error log`, async () => {
    const err = httpError()
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      answerWidgetQuery: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(
        api,
        regularWidget,
        {
          log: {warn, error},
          onSendError: (_e: unknown, info: unknown) => {
            seen.push(info)
          }
        },
        widgetQueryUpdate
      ).renderWidgetAnswer()
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `widgetpage`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })
})
