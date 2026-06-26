import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, gmedia, type TestEnvironment} from "./setup"

let env: TestEnvironment

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: Media pages`, () => {
  it(`TestPhotoPage return a photo media response`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(`test-photo`)

    const editMediaReq = env.mockServer.lastRequest(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(editMediaReq!.body?.media?.type).toBe(`photo`)
    expect(editMediaReq!.body?.media?.media).toBe(gmedia(`test-photo`, `s1`, {}).src)
    expect(editMediaReq!.body?.media?.caption).toBe(gmedia(`test-photo`, `s1`, {}).caption)

    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`test-photo`, {user: {language_code: `id`}})
    const idReq = env.mockServer.lastRequest(`editMessageMedia`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.media?.caption).toBe(gmedia(`test-photo`, `s1`, {}, `id`).caption)
  })

  it(`TestVideoPage return a video media response`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(`test-video`)

    const editMediaReq = env.mockServer.lastRequest(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(editMediaReq!.body?.media?.type).toBe(`video`)
    expect(editMediaReq!.body?.media?.media).toBe(gmedia(`test-video`, `s1`, {}).src)
    expect(editMediaReq!.body?.media?.caption).toBe(gmedia(`test-video`, `s1`, {}).caption)

    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`test-video`, {user: {language_code: `id`}})
    const idReq = env.mockServer.lastRequest(`editMessageMedia`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.media?.caption).toBe(gmedia(`test-video`, `s1`, {}, `id`).caption)
  })

  it(`TestAudioPage return an audio media response`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(`test-audio`)

    const editMediaReq = env.mockServer.lastRequest(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(editMediaReq!.body?.media?.type).toBe(`audio`)
    expect(editMediaReq!.body?.media?.media).toBe(gmedia(`test-audio`, `s1`, {}).src)
    expect(editMediaReq!.body?.media?.caption).toBe(gmedia(`test-audio`, `s1`, {}).caption)

    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`test-audio`, {user: {language_code: `id`}})
    const idReq = env.mockServer.lastRequest(`editMessageMedia`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.media?.caption).toBe(gmedia(`test-audio`, `s1`, {}, `id`).caption)
  })

  it(`TestDocumentPage return a document media response`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(`test-document`)

    const editMediaReq = env.mockServer.lastRequest(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(editMediaReq!.body?.media?.type).toBe(`document`)
    expect(editMediaReq!.body?.media?.media).toBe(gmedia(`test-document`, `s1`, {}).src)
    expect(editMediaReq!.body?.media?.caption).toBe(gmedia(`test-document`, `s1`, {}).caption)

    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`test-document`, {user: {language_code: `id`}})
    const idReq = env.mockServer.lastRequest(`editMessageMedia`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.media?.caption).toBe(gmedia(`test-document`, `s1`, {}, `id`).caption)
  })

  it(`TestStickerPage return a sticker response with expected source`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(`test-sticker`)

    const sendStickerReq = env.mockServer.lastRequest(`sendSticker`)
    expect(sendStickerReq).toBeDefined()
    expect(sendStickerReq!.body?.sticker).toBe(gmedia(`test-sticker`, `s1`, {}).src)

    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`test-sticker`, {user: {language_code: `id`}})
    const idReq = env.mockServer.lastRequest(`sendSticker`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.sticker).toBe(gmedia(`test-sticker`, `s1`, {}, `id`).src)
  })

  it(`TestLocationPage return a location response with coordinates`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(`test-location`)

    const sendLocationReq = env.mockServer.lastRequest(`sendLocation`)
    expect(sendLocationReq).toBeDefined()
    expect(typeof sendLocationReq!.body?.latitude).toBe(`number`)
    expect(typeof sendLocationReq!.body?.longitude).toBe(`number`)
  })

  it(`TestContactPage return a contact response with phone and name`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(`test-contact`)

    const sendContactReq = env.mockServer.lastRequest(`sendContact`)
    expect(sendContactReq).toBeDefined()
    expect(sendContactReq!.body?.phone_number).toBe(`442071234567`)
    expect(sendContactReq!.body?.first_name).toBe(`England`)
  })
})
