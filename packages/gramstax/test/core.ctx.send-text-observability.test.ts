import {describe, expect, it, mock} from "bun:test"
import {GrammyError, HttpError} from "grammy"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

class TextObservePage extends Ctx {
  static data = Ctx.buildData({name: `textobserve`})
}

const grammyError = (code: number) => new GrammyError(`Call failed!`, {error_code: code, description: `desc`, parameters: {}} as never, `sendMessage`, {})

const httpError = () => new HttpError(`net down`, new Error(`socket`))

const makeApi = (overrides?: Record<string, unknown>) => ({
  config: {use: () => {}},
  sendMessage: mock(async () => ({message_id: 9}) as never),
  sendRichMessage: mock(async () => ({message_id: 9}) as never),
  editMessageText: mock(async () => ({message_id: 2}) as never),
  deleteMessage: mock(async () => true as never),
  ...(overrides ?? {})
})

const messageUpdate = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}

const editUpdate = {callback_query: {id: `q`, data: `x`, chat_instance: `ci`, message: {message_id: 2, date: 2, text: `m`, chat: {id: 1, type: `private`}}}}

const makeCtx = (api: Record<string, unknown>, extra?: {log?: unknown; onSendError?: unknown}, update: Record<string, unknown> = messageUpdate, rich = false) => {
  const tm = {getGMessage: mock(() => ({kind: `message`, text: `hello`, rich})), getGMedia: mock(() => ({type: `photo`, src: `pic.jpg`, caption: `Hi`}))} as never
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ICtxParams[`ct`]
  return new TextObservePage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ICtxParams[`templateManager`],
    log: (extra?.log ?? null) as unknown as ICtxParams[`log`],
    onSendError: (extra?.onSendError ?? null) as unknown as ICtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

describe(`text-render-observe`, () => {
  it(`renderText notifies fallback-text with page, kind, chatId and rethrows the original 403 error`, async () => {
    const err = grammyError(403)
    const seen: Array<{err: unknown; info: unknown}> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendMessage: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, {
        log: {warn, error},
        onSendError: (e: unknown, info: unknown) => {
          seen.push({err: e, info})
        }
      }).renderText()
    ).rejects.toBe(err)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `textobserve`, kind: `fallback-text`, chatId: 1})
    expect(warn).toHaveBeenCalledTimes(1)
    expect((warn.mock.calls as any)[0][0]).toContain(`textobserve`)
    expect(error).not.toHaveBeenCalled()
  })

  it(`renderText notifies retryable with error log and rethrows the original 500 error`, async () => {
    const err = grammyError(500)
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendMessage: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, {
        log: {warn, error},
        onSendError: (_e: unknown, info: unknown) => {
          seen.push(info)
        }
      }).renderText()
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `textobserve`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
    const msg = (error.mock.calls as any)[0][0] as string
    expect(msg).toContain(`textobserve`)
    expect(msg).toContain(`1`)
    expect(warn).not.toHaveBeenCalled()
  })

  it(`renderText (rich template) notifies fallback-text and rethrows the original 403 error`, async () => {
    const err = grammyError(403)
    const seen: Array<{err: unknown; info: unknown}> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendRichMessage: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(
        api,
        {
          log: {warn, error},
          onSendError: (e: unknown, info: unknown) => {
            seen.push({err: e, info})
          }
        },
        messageUpdate,
        true
      ).renderText()
    ).rejects.toBe(err)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `textobserve`, kind: `fallback-text`, chatId: 1})
    expect(warn).toHaveBeenCalledTimes(1)
    expect((warn.mock.calls as any)[0][0]).toContain(`textobserve`)
    expect(error).not.toHaveBeenCalled()
  })

  it(`renderText (rich template) notifies retryable with error log and rethrows the original transport error`, async () => {
    const err = httpError()
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      sendRichMessage: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(
        api,
        {
          log: {warn, error},
          onSendError: (_e: unknown, info: unknown) => {
            seen.push(info)
          }
        },
        messageUpdate,
        true
      ).renderText()
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `textobserve`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })

  it(`renderText rethrows without a hook when none is configured`, async () => {
    const err = grammyError(403)
    const api = makeApi({
      sendMessage: mock(async () => {
        throw err
      })
    })
    await expect(makeCtx(api).renderText()).rejects.toBe(err)
    expect((await makeCtx(api, undefined, messageUpdate, true).renderText()) as unknown).toEqual({message_id: 9})
  })
})

describe(`text-edit-observe`, () => {
  it(`renderText edit mode still delivers the fallback reply after an edit failure without notifying`, async () => {
    const hook = mock(() => {})
    const warn = mock(() => {})
    const api = makeApi({
      editMessageText: mock(async () => {
        throw new Error(`too old`)
      })
    })
    const result = (await makeCtx(api, {log: {warn}, onSendError: hook}, editUpdate).renderText({mode: `edit`})) as unknown
    expect(result).toEqual({message_id: 9})
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect((warn.mock.calls as any)[0][0]).toContain(`textobserve`)
    expect(hook).not.toHaveBeenCalled()
  })

  it(`renderText edit mode notifies exactly once when the fallback reply fails with 403`, async () => {
    const err = grammyError(403)
    const seen: Array<unknown> = []
    const api = makeApi({
      editMessageText: mock(async () => {
        throw new Error(`too old`)
      }),
      sendMessage: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(
        api,
        {
          onSendError: (_e: unknown, info: unknown) => {
            seen.push(info)
          }
        },
        editUpdate
      ).renderText({mode: `edit`})
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `textobserve`, kind: `fallback-text`, chatId: 1}])
  })

  it(`renderText edit mode notifies retryable with error log when the fallback reply fails with 500`, async () => {
    const err = grammyError(500)
    const seen: Array<unknown> = []
    const warn = mock(() => {})
    const error = mock(() => {})
    const api = makeApi({
      editMessageText: mock(async () => {
        throw new Error(`too old`)
      }),
      sendMessage: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(
        api,
        {
          log: {warn, error},
          onSendError: (_e: unknown, info: unknown) => {
            seen.push(info)
          }
        },
        editUpdate
      ).renderText({mode: `edit`})
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `textobserve`, kind: `retryable`, chatId: 1}])
    expect(error).toHaveBeenCalledTimes(1)
  })

  it(`renderText edit mode with disable rethrows the edit error without notifying`, async () => {
    const err = new Error(`too old`)
    const hook = mock(() => {})
    const api = makeApi({
      editMessageText: mock(async () => {
        throw err
      })
    })
    await expect(makeCtx(api, {onSendError: hook}, editUpdate).renderText({mode: `edit`, fallback: `disable`})).rejects.toBe(err)
    expect(hook).not.toHaveBeenCalled()
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it(`renderText edit mode (rich template) still delivers the fallback reply after an edit failure without notifying`, async () => {
    const hook = mock(() => {})
    const warn = mock(() => {})
    const api = makeApi({
      editMessageText: mock(async () => {
        throw new Error(`too old`)
      })
    })
    const result = (await makeCtx(api, {log: {warn}, onSendError: hook}, editUpdate, true).renderText({mode: `edit`})) as unknown
    expect(result).toEqual({message_id: 9})
    expect(api.sendRichMessage).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(hook).not.toHaveBeenCalled()
  })

  it(`renderText edit mode (rich template) notifies exactly once when the fallback reply fails with 403`, async () => {
    const err = grammyError(403)
    const seen: Array<unknown> = []
    const api = makeApi({
      editMessageText: mock(async () => {
        throw new Error(`too old`)
      }),
      sendRichMessage: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(
        api,
        {
          onSendError: (_e: unknown, info: unknown) => {
            seen.push(info)
          }
        },
        editUpdate,
        true
      ).renderText({mode: `edit`})
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `textobserve`, kind: `fallback-text`, chatId: 1}])
  })

  it(`renderText edit mode (rich template) notifies retryable when the fallback reply fails with 500`, async () => {
    const err = grammyError(500)
    const seen: Array<unknown> = []
    const api = makeApi({
      editMessageText: mock(async () => {
        throw new Error(`too old`)
      }),
      sendRichMessage: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(
        api,
        {
          onSendError: (_e: unknown, info: unknown) => {
            seen.push(info)
          }
        },
        editUpdate,
        true
      ).renderText({mode: `edit`})
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `textobserve`, kind: `retryable`, chatId: 1}])
  })
})

describe(`text-auto-observe-once`, () => {
  it(`renderText auto reply mode notifies exactly once on 403`, async () => {
    const err = grammyError(403)
    const seen: Array<unknown> = []
    const api = makeApi({
      sendMessage: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(api, {
        onSendError: (_e: unknown, info: unknown) => {
          seen.push(info)
        }
      }).renderText()
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `textobserve`, kind: `fallback-text`, chatId: 1}])
  })

  it(`renderText auto edit mode notifies exactly once when the fallback reply fails`, async () => {
    const err = grammyError(500)
    const seen: Array<unknown> = []
    const api = makeApi({
      editMessageText: mock(async () => {
        throw new Error(`too old`)
      }),
      sendMessage: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(
        api,
        {
          onSendError: (_e: unknown, info: unknown) => {
            seen.push(info)
          }
        },
        editUpdate
      ).renderText()
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `textobserve`, kind: `retryable`, chatId: 1}])
  })

  it(`renderText auto rich reply mode notifies exactly once on 403`, async () => {
    const err = grammyError(403)
    const seen: Array<unknown> = []
    const api = makeApi({
      sendRichMessage: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(
        api,
        {
          onSendError: (_e: unknown, info: unknown) => {
            seen.push(info)
          }
        },
        messageUpdate,
        true
      ).renderText()
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `textobserve`, kind: `fallback-text`, chatId: 1}])
  })

  it(`renderText auto rich edit mode notifies exactly once when the fallback reply fails`, async () => {
    const err = grammyError(500)
    const seen: Array<unknown> = []
    const api = makeApi({
      editMessageText: mock(async () => {
        throw new Error(`too old`)
      }),
      sendRichMessage: mock(async () => {
        throw err
      })
    })
    await expect(
      makeCtx(
        api,
        {
          onSendError: (_e: unknown, info: unknown) => {
            seen.push(info)
          }
        },
        editUpdate,
        true
      ).renderText()
    ).rejects.toBe(err)
    expect(seen).toEqual([{page: `textobserve`, kind: `retryable`, chatId: 1}])
  })
})
