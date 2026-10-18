import {describe, expect, it, mock} from "bun:test"
import {GrammyError} from "grammy"
import {Ctx} from "~/core/ctx"
import type {IBroadcastEditResult, ICtxParams} from "~/types/ctx"

class EditPage extends Ctx {
  static data = Ctx.buildData({name: `broadcast-edit`})
}

const grammyError = (code: number, params?: Record<string, unknown>) => new GrammyError(`Call failed!`, {error_code: code, description: `desc`, parameters: params ?? {}} as never, `sendPhoto`, {})

const makeApi = (overrides?: Record<string, unknown>) => ({
  config: {use: () => {}},
  sendMessage: mock(async () => ({message_id: 9}) as never),
  sendPhoto: mock(async () => ({message_id: 1}) as never),
  sendVideo: mock(async () => ({message_id: 1}) as never),
  sendAudio: mock(async () => ({message_id: 1}) as never),
  sendDocument: mock(async () => ({message_id: 1}) as never),
  sendAnimation: mock(async () => ({message_id: 1}) as never),
  sendVoice: mock(async () => ({message_id: 1}) as never),
  sendVideoNote: mock(async () => ({message_id: 1}) as never),
  sendSticker: mock(async () => ({message_id: 1}) as never),
  sendLocation: mock(async () => ({message_id: 1}) as never),
  sendContact: mock(async () => ({message_id: 1}) as never),
  sendMediaGroup: mock(async () => [{message_id: 1}] as never),
  editMessageMedia: mock(async () => ({message_id: 1}) as never),
  deleteMessage: mock(async () => true as never),
  ...(overrides ?? {})
})

const makeCtx = (med: unknown, api: Record<string, unknown>, log?: unknown) => {
  const tm = {getGMessage: mock(() => ({kind: `message`, text: `hello`, rich: false})), getGMedia: mock(() => med)}
  const update = {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from: {id: 1, is_bot: false, first_name: `A`}}}
  const ct = {api, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ICtxParams[`ct`]
  return new EditPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as unknown as ICtxParams[`templateManager`],
    log: (log ?? null) as ICtxParams[`log`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

const photoMed = (extra?: Record<string, unknown>) => ({type: `photo`, src: `pic.jpg`, caption: `Hi`, ...(extra ?? {})})

const targets = (n: number, base = 101) => Array.from({length: n}, (_, i) => ({chatId: base + i, messageId: 1000 + i}))

const calls = (api: Record<string, unknown>, method: string): Array<Array<unknown>> => (api[method] as {mock: {calls: Array<Array<unknown>>}}).mock.calls

const callCount = (api: Record<string, unknown>, method: string): number => calls(api, method).length

describe(`broadcast-edit-success`, () => {
  it(`edits photos in place with media and caption`, async () => {
    const api = makeApi()
    const res = await makeCtx(photoMed(), api).renderMedia({type: `photo`, broadcast: {targets: targets(2)}})
    expect(res).toEqual({successCount: 2, failedCount: 0, totalCount: 2, skippedCount: 0, retryable: []})
    expect(api.editMessageMedia).toHaveBeenCalledTimes(2)
    expect(api.editMessageMedia).toHaveBeenNthCalledWith(1, 101, 1000, expect.objectContaining({caption: `Hi`, type: `photo`, parse_mode: `HTML`}), expect.objectContaining({}))
    expect((calls(api, `editMessageMedia`)[0]![2] as {media: unknown}).media).toBe(`pic.jpg`)
    expect(api.deleteMessage).not.toHaveBeenCalled()
    expect(api.sendPhoto).not.toHaveBeenCalled()
  })

  it(`covers every per-type primary path`, async () => {
    const cases: Array<{type: string; med: unknown; primary: string}> = [
      {type: `video`, med: {type: `video`, src: `v.mp4`, caption: `V`}, primary: `editMessageMedia`},
      {type: `audio`, med: {type: `audio`, src: `a.mp3`, caption: `A`}, primary: `editMessageMedia`},
      {type: `document`, med: {type: `document`, src: `d.pdf`, caption: `D`}, primary: `editMessageMedia`},
      {type: `animation`, med: {type: `animation`, src: `a.gif`, caption: `G`}, primary: `editMessageMedia`},
      {type: `voice`, med: {type: `voice`, src: `v.ogg`}, primary: `sendVoice`},
      {type: `video_note`, med: {type: `video_note`, src: `n.mp4`}, primary: `sendVideoNote`},
      {type: `sticker`, med: {type: `sticker`, src: `s.webp`}, primary: `sendSticker`},
      {type: `location`, med: {type: `location`, latitude: `10`, longitude: `20`}, primary: `sendLocation`},
      {type: `contact`, med: {type: `contact`, phone: `+1`, first_name: `A`}, primary: `sendContact`}
    ]
    for (const c of cases) {
      const api = makeApi()
      const res = (await makeCtx(c.med, api).renderMedia({type: c.type as never, broadcast: {targets: targets(1)}})) as IBroadcastEditResult
      expect(res.successCount).toBe(1)
      expect(callCount(api, c.primary)).toBe(1)
      if (c.primary === `editMessageMedia`) {
        expect(api.deleteMessage).not.toHaveBeenCalled()
      } else {
        expect(api.deleteMessage).toHaveBeenCalledTimes(1)
        expect(api.editMessageMedia).not.toHaveBeenCalled()
      }
    }
  })

  it(`deletes and resends voice (delete+resend type)`, async () => {
    const api = makeApi()
    const res = (await makeCtx({type: `voice`, src: `v.ogg`}, api).renderMedia({type: `voice`, broadcast: {targets: targets(1, 7)}})) as IBroadcastEditResult
    expect(res.successCount).toBe(1)
    expect(api.deleteMessage).toHaveBeenNthCalledWith(1, 7, 1000)
    expect(api.sendVoice).toHaveBeenNthCalledWith(1, 7, `v.ogg`, expect.objectContaining({}))
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })

  it(`sends validated location coords and contact fields`, async () => {
    const api = makeApi()
    await makeCtx({type: `location`, latitude: `10`, longitude: `20`}, api).renderMedia({type: `location`, broadcast: {targets: targets(1)}})
    expect(api.sendLocation).toHaveBeenNthCalledWith(1, 101, 10, 20, expect.objectContaining({}))
    const api2 = makeApi()
    await makeCtx({type: `contact`, phone: `+1`, first_name: `A`}, api2).renderMedia({type: `contact`, broadcast: {targets: targets(1)}})
    expect(api2.sendContact).toHaveBeenNthCalledWith(1, 101, `+1`, `A`, expect.objectContaining({}))
  })

  it(`deletes and resends multi-src media as a group`, async () => {
    const api = makeApi()
    const med = {type: `photo`, src: `a.jpg`, srcList: [`a.jpg`, `b.jpg`], caption: `G`}
    const res = await makeCtx(med, api).renderMedia({type: `photo`, broadcast: {targets: targets(2)}})
    expect(res).toEqual({successCount: 2, failedCount: 0, totalCount: 2, skippedCount: 0, retryable: []})
    expect(api.deleteMessage).toHaveBeenCalledTimes(2)
    expect(api.sendMediaGroup).toHaveBeenCalledTimes(2)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })
})

describe(`broadcast-edit-resume-progress-concurrency`, () => {
  it(`startFrom skips already-revised recipients without duplicates`, async () => {
    const api = makeApi()
    const res = await makeCtx(photoMed(), api).renderMedia({type: `photo`, broadcast: {targets: targets(4), broadcastOpts: {startFrom: 2}}})
    expect(res).toEqual({successCount: 2, failedCount: 0, totalCount: 4, skippedCount: 2, retryable: []})
    expect(api.editMessageMedia).toHaveBeenCalledTimes(2)
    expect(calls(api, `editMessageMedia`).map((c) => c[0])).toEqual([103, 104])
  })

  it(`fires per chunk plus final with exact counts`, async () => {
    const api = makeApi()
    const progress = mock(() => {})
    const res = (await makeCtx(photoMed(), api).renderMedia({type: `photo`, broadcast: {targets: targets(5), broadcastOpts: {chunkSize: 2, chunkDelayMs: 1, onProgress: progress}}})) as IBroadcastEditResult
    expect(res.successCount).toBe(5)
    expect(progress.mock.calls as Array<Array<number>>).toEqual([
      [2, 5],
      [4, 5],
      [5, 5]
    ])
  })

  it(`delivers all recipients across lanes with aligned targets`, async () => {
    const api = makeApi()
    const res = await makeCtx(photoMed(), api).renderMedia({type: `photo`, broadcast: {targets: targets(6), broadcastOpts: {concurrency: 3}}})
    expect(res).toEqual({successCount: 6, failedCount: 0, totalCount: 6, skippedCount: 0, retryable: []})
    expect(api.editMessageMedia).toHaveBeenCalledTimes(6)
    expect(
      calls(api, `editMessageMedia`)
        .map((c) => c[0])
        .sort()
    ).toEqual([101, 102, 103, 104, 105, 106])
  })

  it(`fires at the free-limit boundary and at completion`, async () => {
    const api = makeApi()
    const progress = mock(() => {})
    const res = (await makeCtx(photoMed(), api).renderMedia({type: `photo`, broadcast: {targets: targets(30), broadcastOpts: {onProgress: progress}}})) as IBroadcastEditResult
    expect(res.successCount).toBe(30)
    expect(progress.mock.calls as Array<Array<number>>).toEqual([
      [30, 30],
      [30, 30]
    ])
  })
})

describe(`broadcast-edit-fallback`, () => {
  it(`resends each editable type after an edit failure`, async () => {
    const sends: Record<string, string> = {photo: `sendPhoto`, video: `sendVideo`, audio: `sendAudio`, document: `sendDocument`, animation: `sendAnimation`}
    for (const t of [`photo`, `video`, `audio`, `document`, `animation`]) {
      const api = makeApi({
        editMessageMedia: mock(async () => {
          throw grammyError(400)
        })
      })
      const res = (await makeCtx({type: t, src: `f.dat`, caption: `C`}, api).renderMedia({type: t as never, broadcast: {targets: targets(1)}})) as IBroadcastEditResult
      expect(res.successCount).toBe(1)
      expect(api.deleteMessage).toHaveBeenCalledTimes(1)
      expect(callCount(api, sends[t]!)).toBe(1)
    }
  })

  it(`warns when the fallback drops edit options`, async () => {
    const warn = mock(() => {})
    const api = makeApi({
      editMessageMedia: mock(async () => {
        throw grammyError(400)
      })
    })
    const res = (await makeCtx(photoMed(), api, {warn}).renderMedia({type: `photo`, optionsEdit1: {caption: `X`} as never, broadcast: {targets: targets(1)}})) as IBroadcastEditResult
    expect(res.successCount).toBe(1)
    expect(warn).toHaveBeenCalled()
  })

  it(`separates retryable failures while the loop continues`, async () => {
    const err429 = grammyError(429)
    const api = makeApi({
      editMessageMedia: mock(async () => {
        throw err429
      }),
      sendPhoto: mock(async () => {
        throw err429
      })
    })
    const list = targets(3)
    const res = (await makeCtx(photoMed(), api).renderMedia({type: `photo`, broadcast: {targets: list}})) as IBroadcastEditResult
    expect(res.successCount).toBe(0)
    expect(res.failedCount).toBe(3)
    expect(res.retryable).toEqual(list.map((t, i) => ({index: i, chatId: t.chatId, messageId: t.messageId, error: err429})))
  })

  it(`delivers best-effort text on fallback-text failures`, async () => {
    const err403 = grammyError(403)
    const api = makeApi({
      editMessageMedia: mock(async () => {
        throw err403
      }),
      sendPhoto: mock(async () => {
        throw err403
      })
    })
    const res = (await makeCtx(photoMed(), api).renderMedia({type: `photo`, broadcast: {targets: targets(2)}})) as IBroadcastEditResult
    expect(res.successCount).toBe(0)
    expect(res.failedCount).toBe(2)
    expect(res.retryable).toEqual([])
    expect(api.sendMessage).toHaveBeenCalledTimes(2)
    expect(calls(api, `sendMessage`).map((c) => c[0])).toEqual([101, 102])
    expect(calls(api, `sendMessage`)[0]![1]).toBe(`Media unavailable`)
  })

  it(`classifies the primary error directly when fallback is disabled`, async () => {
    const err429 = grammyError(429)
    const api = makeApi({
      editMessageMedia: mock(async () => {
        throw err429
      })
    })
    const res = (await makeCtx(photoMed(), api).renderMedia({type: `photo`, broadcast: {targets: targets(1), broadcastOpts: {fallbackEdit: `disable`}}})) as IBroadcastEditResult
    expect(res.failedCount).toBe(1)
    expect(res.retryable).toEqual([{index: 0, chatId: 101, messageId: 1000, error: err429}])
    expect(api.sendPhoto).not.toHaveBeenCalled()
    expect(api.deleteMessage).not.toHaveBeenCalled()
  })

  it(`still resends when the fallback delete already failed`, async () => {
    const api = makeApi({
      editMessageMedia: mock(async () => {
        throw grammyError(400)
      }),
      deleteMessage: mock(async () => {
        throw grammyError(400)
      })
    })
    const res = (await makeCtx(photoMed(), api).renderMedia({type: `photo`, broadcast: {targets: targets(1)}})) as IBroadcastEditResult
    expect(res.successCount).toBe(1)
  })
})

describe(`broadcast-edit-fail-fast`, () => {
  it(`throws on unknown type before any send`, async () => {
    const api = makeApi()
    await expect(makeCtx(photoMed(), api).renderMedia({type: `nope` as never, broadcast: {targets: targets(2)}})).rejects.toThrow(`Unknown media type`)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
    expect(api.sendPhoto).not.toHaveBeenCalled()
    expect(api.deleteMessage).not.toHaveBeenCalled()
  })

  it(`throws on oversize media before any send`, async () => {
    const big = new Uint8Array(11 * 1024 * 1024)
    const api = makeApi()
    await expect(makeCtx({type: `photo`, src: big, caption: `Hi`}, api).renderMedia({type: `photo`, broadcast: {targets: targets(1)}})).rejects.toThrow(`exceeds limit`)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })

  it(`throws on bad coords, bad contact, and missing media`, async () => {
    const api = makeApi()
    await expect(makeCtx({type: `location`, latitude: `bad`, longitude: `0`}, api).renderMedia({type: `location`, broadcast: {targets: targets(1)}})).rejects.toThrow(`Invalid latitude`)
    await expect(makeCtx({type: `contact`, phone: ``, first_name: `A`}, api).renderMedia({type: `contact`, broadcast: {targets: targets(1)}})).rejects.toThrow(`Contact requires`)
    await expect(makeCtx(undefined, api).renderMedia({type: `photo`, broadcast: {targets: targets(1)}})).rejects.toThrow(`Media not found`)
    expect(api.editMessageMedia).not.toHaveBeenCalled()
  })

  it(`keeps the default call sequence and result shape`, async () => {
    const api = makeApi()
    const res = await makeCtx(photoMed(), api).renderMedia({type: `photo`, broadcast: {targets: targets(2)}})
    expect(res).toEqual({successCount: 2, failedCount: 0, totalCount: 2, skippedCount: 0, retryable: []})
    expect(api.editMessageMedia).toHaveBeenNthCalledWith(1, 101, 1000, expect.objectContaining({caption: `Hi`, parse_mode: `HTML`}), expect.objectContaining({}))
  })
})

describe(`broadcast-delete`, () => {
  it(`deletes every stored message`, async () => {
    const api = makeApi()
    const res = await makeCtx(photoMed(), api).renderBroadcastDelete({targets: targets(3)})
    expect(res).toEqual({successCount: 3, failedCount: 0, totalCount: 3, skippedCount: 0, retryable: []})
    expect(api.deleteMessage).toHaveBeenCalledTimes(3)
    expect(calls(api, `deleteMessage`)).toEqual([
      [101, 1000],
      [102, 1001],
      [103, 1002]
    ])
  })

  it(`records retryable deletes and counts fallback-text without any text fallback`, async () => {
    const err429 = grammyError(429)
    const err403 = grammyError(403)
    const api = makeApi({
      deleteMessage: mock(async (chatId: number) => {
        if (chatId === 101) throw err429
        if (chatId === 102) throw err403
        return true as never
      })
    })
    const res = await makeCtx(photoMed(), api).renderBroadcastDelete({targets: targets(3)})
    expect(res.successCount).toBe(1)
    expect(res.failedCount).toBe(2)
    expect(res.retryable).toEqual([{index: 0, chatId: 101, messageId: 1000, error: err429}])
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it(`resumes from a checkpoint without duplicates`, async () => {
    const api = makeApi()
    const res = await makeCtx(photoMed(), api).renderBroadcastDelete({targets: targets(3), broadcastOpts: {startFrom: 1}})
    expect(res).toEqual({successCount: 2, failedCount: 0, totalCount: 3, skippedCount: 1, retryable: []})
    expect(calls(api, `deleteMessage`)).toEqual([
      [102, 1001],
      [103, 1002]
    ])
  })

  it(`fires per chunk plus final with exact counts`, async () => {
    const api = makeApi()
    const progress = mock(() => {})
    const res = await makeCtx(photoMed(), api).renderBroadcastDelete({targets: targets(4), broadcastOpts: {chunkSize: 2, chunkDelayMs: 1, onProgress: progress}})
    expect(res.successCount).toBe(4)
    expect(progress.mock.calls as Array<Array<number>>).toEqual([
      [2, 4],
      [4, 4]
    ])
  })

  it(`deletes across lanes with aligned targets`, async () => {
    const api = makeApi()
    const res = await makeCtx(photoMed(), api).renderBroadcastDelete({targets: targets(4), broadcastOpts: {concurrency: 2}})
    expect(res).toEqual({successCount: 4, failedCount: 0, totalCount: 4, skippedCount: 0, retryable: []})
    expect(
      calls(api, `deleteMessage`)
        .map((c) => c[0])
        .sort()
    ).toEqual([101, 102, 103, 104])
  })

  it(`fires at the free-limit boundary and at completion`, async () => {
    const api = makeApi()
    const progress = mock(() => {})
    const res = await makeCtx(photoMed(), api).renderBroadcastDelete({targets: targets(30), broadcastOpts: {onProgress: progress}})
    expect(res.successCount).toBe(30)
    expect(progress.mock.calls as Array<Array<number>>).toEqual([
      [30, 30],
      [30, 30]
    ])
  })
})
