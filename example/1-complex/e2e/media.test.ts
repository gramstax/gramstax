import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: Media pages`, () => {
  it(`TestPhotoPage return a photo media response`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(`test-photo`)

    const editMediaReq = e2e.lastCall(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(editMediaReq!.body?.media?.type).toBe(`photo`)
    expect(editMediaReq!.body?.media?.media).toBe(e2e.gmedia(`test-photo`, `s1`, {}).src)
    expect(editMediaReq!.body?.media?.caption).toBe(e2e.gmedia(`test-photo`, `s1`, {}).caption)

    e2e.clearCalls()
    await e2e.sendCallbackQuery(`test-photo`, {user: {language_code: `id`}})
    const idReq = e2e.lastCall(`editMessageMedia`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.media?.caption).toBe(e2e.gmedia(`test-photo`, `s1`, {}, `id`).caption)
  })

  it(`TestVideoPage return a video media response`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(`test-video`)

    const editMediaReq = e2e.lastCall(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(editMediaReq!.body?.media?.type).toBe(`video`)
    expect(editMediaReq!.body?.media?.media).toBe(e2e.gmedia(`test-video`, `s1`, {}).src)
    expect(editMediaReq!.body?.media?.caption).toBe(e2e.gmedia(`test-video`, `s1`, {}).caption)

    e2e.clearCalls()
    await e2e.sendCallbackQuery(`test-video`, {user: {language_code: `id`}})
    const idReq = e2e.lastCall(`editMessageMedia`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.media?.caption).toBe(e2e.gmedia(`test-video`, `s1`, {}, `id`).caption)
  })

  it(`TestAudioPage return an audio media response`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(`test-audio`)

    const editMediaReq = e2e.lastCall(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(editMediaReq!.body?.media?.type).toBe(`audio`)
    expect(editMediaReq!.body?.media?.media).toBe(e2e.gmedia(`test-audio`, `s1`, {}).src)
    expect(editMediaReq!.body?.media?.caption).toBe(e2e.gmedia(`test-audio`, `s1`, {}).caption)

    e2e.clearCalls()
    await e2e.sendCallbackQuery(`test-audio`, {user: {language_code: `id`}})
    const idReq = e2e.lastCall(`editMessageMedia`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.media?.caption).toBe(e2e.gmedia(`test-audio`, `s1`, {}, `id`).caption)
  })

  it(`TestDocumentPage return a document media response`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(`test-document`)

    const editMediaReq = e2e.lastCall(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(editMediaReq!.body?.media?.type).toBe(`document`)
    expect(editMediaReq!.body?.media?.media).toBe(e2e.gmedia(`test-document`, `s1`, {}).src)
    expect(editMediaReq!.body?.media?.caption).toBe(e2e.gmedia(`test-document`, `s1`, {}).caption)

    e2e.clearCalls()
    await e2e.sendCallbackQuery(`test-document`, {user: {language_code: `id`}})
    const idReq = e2e.lastCall(`editMessageMedia`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.media?.caption).toBe(e2e.gmedia(`test-document`, `s1`, {}, `id`).caption)
  })

  it(`TestStickerPage return a sticker response with expected source`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(`test-sticker`)

    const sendStickerReq = e2e.lastCall(`sendSticker`)
    expect(sendStickerReq).toBeDefined()
    expect(sendStickerReq!.body?.sticker).toBe(e2e.gmedia(`test-sticker`, `s1`, {}).src)

    e2e.clearCalls()
    await e2e.sendCallbackQuery(`test-sticker`, {user: {language_code: `id`}})
    const idReq = e2e.lastCall(`sendSticker`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.sticker).toBe(e2e.gmedia(`test-sticker`, `s1`, {}, `id`).src)
  })

  it(`TestLocationPage return a location response with coordinates`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(`test-location`)

    const sendLocationReq = e2e.lastCall(`sendLocation`)
    expect(sendLocationReq).toBeDefined()
    expect(typeof sendLocationReq!.body?.latitude).toBe(`number`)
    expect(typeof sendLocationReq!.body?.longitude).toBe(`number`)
  })

  it(`TestContactPage return a contact response with phone and name`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(`test-contact`)

    const sendContactReq = e2e.lastCall(`sendContact`)
    expect(sendContactReq).toBeDefined()
    expect(sendContactReq!.body?.phone_number).toBe(`442071234567`)
    expect(sendContactReq!.body?.first_name).toBe(`England`)
  })
})
