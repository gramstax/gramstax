import {describe, it, expect, mock} from "bun:test"
import {BroadcastPage} from "../src/pages/broadcast"

type MediaType = `photo` | `video` | `animation`

const mediaBaseId = {
  photo: BroadcastPage.BASE.deliverPhoto,
  video: BroadcastPage.BASE.deliverVideo,
  animation: BroadcastPage.BASE.deliverAnimation
} as const

const createPage = (mediaType: MediaType) => {
  const sendPhoto = mock(() => true)
  const sendVideo = mock(() => true)
  const sendAnimation = mock(() => true)
  const editMessageText = mock(() => true)

  const ct = {
    api: {sendPhoto, sendVideo, sendAnimation},
    editMessageText
  } as any

  const cacheSession = {
    delete: mock(() => true)
  } as any

  const templateManager = {
    getMedia: mock((_key: string, baseId: string, _lang: string, data: Record<string, any>) => {
      const type = Object.entries(mediaBaseId).find(([, value]) => value === baseId)?.[0] as MediaType
      return {type, src: data.fileId, caption: data.caption}
    }),
    getMessage: mock(() => `ok`),
    getKeyboard: mock(() => [])
  } as any

  const db = {
    listSubscribers: mock(() => [
      {id: 1, language: `default`},
      {id: 2, language: `id`}
    ])
  } as any

  const page = new (BroadcastPage as any)({
    ct,
    cacheSession,
    cacheKeyboard: new Map(),
    templateManager,
    db,
    temp: {
      isAnswer: false,
      session: {params: {step: `confirm`, mediaType, fileId: `${mediaType}-file`, caption: `${mediaType}-caption`}},
      data: {}
    }
  })

  return {page, sendPhoto, sendVideo, sendAnimation}
}

describe(`BroadcastPage media delivery`, () => {
  const cases: Array<{type: MediaType; method: `sendPhoto` | `sendVideo` | `sendAnimation`}> = [
    {type: `photo`, method: `sendPhoto`},
    {type: `video`, method: `sendVideo`},
    {type: `animation`, method: `sendAnimation`}
  ]

  for (const testCase of cases) {
    it(`should broadcast ${testCase.type}`, async () => {
      const {page, sendPhoto, sendVideo, sendAnimation} = createPage(testCase.type)

      await (page as any).handleSend()

      const calls = {
        sendPhoto,
        sendVideo,
        sendAnimation
      }

      expect(calls[testCase.method]).toHaveBeenCalledTimes(2)
      for (const [method, fn] of Object.entries(calls)) {
        if (method !== testCase.method) {
          expect(fn).not.toHaveBeenCalled()
        }
      }
    })
  }
})
