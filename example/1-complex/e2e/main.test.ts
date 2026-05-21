/**
 * E2E Test Flow for Complex Bot
 *
 * Setup:
 *   1. MockTelegramServer starts on random port → apiRoot captured
 *   2. BotCore initialized with webhook:http://127.0.0.1:3001/webhook/e2e-1-complex
 *   3. TemplateManager loads pages from src/pages/
 *
 * Test Flow:
 *   T1. /start → Welcome message + inline keyboard (Counter, Help, Refresh)
 *   T2. /start → callback:help → editMessage → Help & Navigation + Back button
 *   T3. /start → callback:counter → editMessage → Counter + Current count + Increase/Decrease buttons
 *   T4. /unknown → handleFreeText → Result echo (no session)
 *   T5. /start → verify sendMessage request captured in mockServer.requests
 *   T6. /start → callback:help → text:gibberish → Result echo (sequential chain)
 *
 * Cleanup:
 *   - botCore.stop() + mockServer.stop() in afterAll
 *   - mockServer.clearRequests() in beforeEach
 */
import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager} from "gramstax"
import {MockTelegramServer} from "gramstax"
import {describe, it, expect, beforeAll, afterAll, beforeEach} from "bun:test"

let mockServer: MockTelegramServer
let botCore: BotCore

type InlineKeyboardButton = {
  text?: string
  callback_data?: string
}

const createPrivateUserContext = (id: number) => ({
  user: {
    id,
    username: `tester_${id}`,
    first_name: `Tester${id}`
  },
  chat: {
    id,
    type: `private` as const,
    first_name: `Tester${id}`
  }
})

const getCallbackDataByLabel = (responses: Array<{body?: {reply_markup?: {inline_keyboard?: InlineKeyboardButton[][]}}}>, label: string) => {
  const keyboard = responses[0]?.body?.reply_markup?.inline_keyboard
  return keyboard?.flat().find((button) => button.text === label)?.callback_data
}

beforeAll(async () => {
  mockServer = new MockTelegramServer({log: false})
  await mockServer.start()

  const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
  const cwd = process.cwd()
  process.chdir(join(import.meta.dir, `..`))

  botCore = new BotCore({
    deploy: `webhook:http://127.0.0.1:3001/webhook/e2e-1-complex`,
    token: `test-token`,
    log: false,
    templateManager,
    botConfig: {client: {apiRoot: mockServer.apiRoot}}
  })

  process.chdir(cwd)

  const startedAt = Date.now()
  while (!mockServer.webhookUrl && Date.now() - startedAt < 5000) {
    await new Promise((r) => setTimeout(r, 50))
  }
})

afterAll(async () => {
  await botCore.stop()
  await mockServer.stop()
})

beforeEach(() => {
  mockServer.clearRequests()
})

describe(`E2E: Complex bot via MockTelegramServer (webhook)`, () => {
  it(`responds to /start command with welcome message and full keyboard`, async () => {
    const responses = await mockServer.sendText(`/start`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]
    expect(reply).toBeDefined()
    expect(reply!.body?.text).toContain(`Welcome`)

    const keyboard = reply!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    expect(keyboard.length).toBeGreaterThan(0)

    const allButtons = keyboard.flat()
    const buttonLabels = allButtons.map((b: any) => b.text)
    expect(buttonLabels).toContain(`🔢 Counter`)
    expect(buttonLabels).toContain(`❓ Help`)
    expect(buttonLabels).toContain(`🔄 Refresh`)
  })

  it(`navigates to Help page and shows back button`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`help`)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Help & Navigation`)

    const keyboard = edit.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const firstButton = keyboard[0]?.[0]
    expect(firstButton?.text).toContain(`Back`)
  })

  it(`navigates to Counter page and shows increase/decrease buttons`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`counter`)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Counter`)
    expect(edit.body?.text).toContain(`Current count:`)

    const keyboard = edit.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const allButtons = keyboard.flat()
    const buttonLabels = allButtons.map((b: any) => b.text)
    expect(buttonLabels).toContain(`➕ Increase`)
    expect(buttonLabels).toContain(`➖ Decrease`)
  })

  it(`shows result for unrecognized input via handleFreeText`, async () => {
    const responses = await mockServer.sendText(`/unknown`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply).toBeDefined()
    expect(reply.body?.text).toContain(`Result`)
  })

  it(`captures outbound requests in mockServer.requests`, async () => {
    await mockServer.sendText(`/start`)

    const sendMessageReq = mockServer.lastRequest(`sendMessage`)
    expect(sendMessageReq).toBeDefined()
    expect(sendMessageReq?.body?.text).toContain(`Welcome`)
  })

  it(`handles multiple sequential interactions`, async () => {
    const res1 = await mockServer.sendText(`/start`)
    expect(res1[0]?.body?.text).toContain(`Welcome`)

    mockServer.clearRequests()

    const res2 = await mockServer.sendCallbackQuery(`help`)
    expect(res2[0]?.body?.text).toContain(`Help & Navigation`)

    mockServer.clearRequests()

    const res3 = await mockServer.sendText(`gibberish`)
    expect(res3[0]?.body?.text).toContain(`Result`)
  })

  it(`CounterPage increases the counter`, async () => {
    const userContext = createPrivateUserContext(2001)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    const counterCallback = getCallbackDataByLabel(startResponses, `🔢 Counter`)
    expect(counterCallback).toBeDefined()

    mockServer.clearRequests()

    const counterResponses = await mockServer.sendCallbackQuery(counterCallback!, userContext)
    expect(counterResponses.length).toBeGreaterThan(0)
    expect(counterResponses[0]!.body?.text).toContain(`Current count: 0`)

    mockServer.clearRequests()

    const increaseResponses = await mockServer.sendCallbackQuery(`counter:I`, userContext)
    expect(increaseResponses.length).toBeGreaterThan(0)
    expect(increaseResponses[0]!.body?.text).toContain(`Current count: 1`)
  })

  it(`CounterPage decreases the counter after increment`, async () => {
    const userContext = createPrivateUserContext(2002)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    const counterCallback = getCallbackDataByLabel(startResponses, `🔢 Counter`)
    expect(counterCallback).toBeDefined()

    mockServer.clearRequests()

    const counterResponses = await mockServer.sendCallbackQuery(counterCallback!, userContext)
    expect(counterResponses.length).toBeGreaterThan(0)
    expect(counterResponses[0]!.body?.text).toContain(`Current count: 0`)

    mockServer.clearRequests()
    const increaseResponses = await mockServer.sendCallbackQuery(`counter:I`, userContext)
    expect(increaseResponses.length).toBeGreaterThan(0)
    expect(increaseResponses[0]!.body?.text).toContain(`Current count: 1`)

    mockServer.clearRequests()

    const decreaseResponses = await mockServer.sendCallbackQuery(`counter:D`, userContext)
    expect(decreaseResponses.length).toBeGreaterThan(0)
    expect(decreaseResponses[0]!.body?.text).toContain(`Current count: 0`)
  })

  it(`InputTextPage completes the session input flow`, async () => {
    const userContext = createPrivateUserContext(2003)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    const inputTextCallback = getCallbackDataByLabel(startResponses, `✍️ Input Text`)
    expect(inputTextCallback).toBeDefined()

    mockServer.clearRequests()

    const pageResponses = await mockServer.sendCallbackQuery(inputTextCallback!, userContext)
    expect(pageResponses.length).toBeGreaterThan(0)
    expect(pageResponses[0]!.body?.text).toContain(`Input text (with session)`)

    mockServer.clearRequests()

    const resultResponses = await mockServer.sendText(`Hello World`, userContext)
    expect(resultResponses.length).toBeGreaterThan(0)
    expect(resultResponses[0]!.body?.text).toContain(`Result`)
    expect(resultResponses[0]!.body?.text).toContain(`Hello World`)
  })

  it(`TestPhotoPage returns a photo media response`, async () => {
    const userContext = createPrivateUserContext(2004)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    const photoCallback = getCallbackDataByLabel(startResponses, `🖼️ Test Photo`)
    expect(photoCallback).toBeDefined()

    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(photoCallback!, userContext)
    expect(responses.length).toBeGreaterThan(0)

    const editMediaReq = mockServer.lastRequest(`editMessageMedia`)
    const sendPhotoReq = mockServer.lastRequest(`sendPhoto`)
    expect(editMediaReq ?? sendPhotoReq).toBeDefined()
    if (editMediaReq) {
      expect(editMediaReq.body?.media?.type).toBe(`photo`)
    }
    if (sendPhotoReq) {
      expect(String(sendPhotoReq.body?.photo)).toContain(`http`)
    }
  })

  it(`TestVideoPage returns a video media response`, async () => {
    const userContext = createPrivateUserContext(2005)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    const videoCallback = getCallbackDataByLabel(startResponses, `🎥 Test Video`)
    expect(videoCallback).toBeDefined()

    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(videoCallback!, userContext)
    expect(responses.length).toBeGreaterThan(0)

    const editMediaReq = mockServer.lastRequest(`editMessageMedia`)
    const sendVideoReq = mockServer.lastRequest(`sendVideo`)
    expect(editMediaReq ?? sendVideoReq).toBeDefined()
    if (editMediaReq) {
      expect(editMediaReq.body?.media?.type).toBe(`video`)
    }
    if (sendVideoReq) {
      expect(String(sendVideoReq.body?.video)).toContain(`http`)
    }
  })

  it(`TestAudioPage returns an audio media response`, async () => {
    const userContext = createPrivateUserContext(2006)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    const audioCallback = getCallbackDataByLabel(startResponses, `🎧 Test Audio`)
    expect(audioCallback).toBeDefined()

    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(audioCallback!, userContext)
    expect(responses.length).toBeGreaterThan(0)

    const editMediaReq = mockServer.lastRequest(`editMessageMedia`)
    const sendAudioReq = mockServer.lastRequest(`sendAudio`)
    expect(editMediaReq ?? sendAudioReq).toBeDefined()
    if (editMediaReq) {
      expect(editMediaReq.body?.media?.type).toBe(`audio`)
    }
    if (sendAudioReq) {
      expect(String(sendAudioReq.body?.audio)).toContain(`http`)
    }
  })

  it(`TestDocumentPage returns a document media response`, async () => {
    const userContext = createPrivateUserContext(2007)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    const documentCallback = getCallbackDataByLabel(startResponses, `📄 Test Document`)
    expect(documentCallback).toBeDefined()

    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(documentCallback!, userContext)
    expect(responses.length).toBeGreaterThan(0)

    const editMediaReq = mockServer.lastRequest(`editMessageMedia`)
    const sendDocumentReq = mockServer.lastRequest(`sendDocument`)
    expect(editMediaReq ?? sendDocumentReq).toBeDefined()
    if (editMediaReq) {
      expect(editMediaReq.body?.media?.type).toBe(`document`)
    }
    if (sendDocumentReq) {
      expect(String(sendDocumentReq.body?.document)).toContain(`http`)
    }
  })

  it(`TestStickerPage returns a sticker response`, async () => {
    const userContext = createPrivateUserContext(2008)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    const stickerCallback = getCallbackDataByLabel(startResponses, `😀 Test Sticker`)
    expect(stickerCallback).toBeDefined()

    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(stickerCallback!, userContext)
    expect(responses.length).toBeGreaterThan(0)

    const sendStickerReq = mockServer.lastRequest(`sendSticker`)
    expect(sendStickerReq).toBeDefined()
    expect(String(sendStickerReq?.body?.sticker)).toContain(`http`)
  })

  it(`TestLocationPage returns a location response`, async () => {
    const userContext = createPrivateUserContext(2009)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    const locationCallback = getCallbackDataByLabel(startResponses, `📍 Test Location`)
    expect(locationCallback).toBeDefined()

    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(locationCallback!, userContext)
    expect(responses.length).toBeGreaterThan(0)

    const sendLocationReq = mockServer.lastRequest(`sendLocation`)
    expect(sendLocationReq).toBeDefined()
    expect(typeof sendLocationReq?.body?.latitude).toBe(`number`)
    expect(typeof sendLocationReq?.body?.longitude).toBe(`number`)
  })

  it(`TestContactPage returns a contact response`, async () => {
    const userContext = createPrivateUserContext(2010)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    const contactCallback = getCallbackDataByLabel(startResponses, `👤 Test Contact`)
    expect(contactCallback).toBeDefined()

    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(contactCallback!, userContext)
    expect(responses.length).toBeGreaterThan(0)

    const sendContactReq = mockServer.lastRequest(`sendContact`)
    expect(sendContactReq).toBeDefined()
    expect(sendContactReq?.body?.phone_number).toBe(`442071234567`)
    expect(sendContactReq?.body?.first_name).toBe(`England`)
  })

  it(`BlockImportPage shows the block import demo`, async () => {
    const userContext = createPrivateUserContext(2011)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    const blockImportCallback = getCallbackDataByLabel(startResponses, `📦 Block Import`)
    expect(blockImportCallback).toBeDefined()

    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(blockImportCallback!, userContext)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Block import demo`)
    expect(responses[0]!.body?.text).toContain(`Random:`)
  })

  it(`BlockSwitchPage toggles the switch demo`, async () => {
    const userContext = createPrivateUserContext(2012)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    const blockSwitchCallback = getCallbackDataByLabel(startResponses, `🔀 Block Switch`)
    expect(blockSwitchCallback).toBeDefined()

    mockServer.clearRequests()

    const initialResponses = await mockServer.sendCallbackQuery(blockSwitchCallback!, userContext)
    expect(initialResponses.length).toBeGreaterThan(0)
    expect(initialResponses[0]!.body?.text).toContain(`Template switch demo`)
    expect(initialResponses[0]!.body?.text).toContain(`Inactive`)

    const toggleCallback = getCallbackDataByLabel(initialResponses, `🟢 On`)
    expect(toggleCallback).toBeDefined()

    mockServer.clearRequests()

    const toggledResponses = await mockServer.sendCallbackQuery(toggleCallback!, userContext)
    expect(toggledResponses.length).toBeGreaterThan(0)
    expect(toggledResponses[0]!.body?.text).toContain(`Template switch demo`)
    expect(toggledResponses[0]!.body?.text).toContain(`Active`)
  })

  it(`KeyboardBottomPage shows the bottom keyboard`, async () => {
    const responses = await mockServer.sendText(`/keyboard_bottom`)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Bottom keyboard`)
    expect(responses[0]!.body?.reply_markup?.keyboard).toBeDefined()
  })

  it(`TestErrorPage shows the global error response`, async () => {
    const userContext = createPrivateUserContext(2013)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    const errorCallback = getCallbackDataByLabel(startResponses, `🧪 Test Error`)
    expect(errorCallback).toBeDefined()

    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(errorCallback!, userContext)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Something went wrong`)
  })

  it(`Full exploration flow goes from counter to input text to photo and back home`, async () => {
    const userContext = createPrivateUserContext(2014)
    const startResponses = await mockServer.sendText(`/start`, userContext)
    expect(startResponses.length).toBeGreaterThan(0)
    expect(startResponses[0]!.body?.text).toContain(`Welcome`)

    const counterCallback = getCallbackDataByLabel(startResponses, `🔢 Counter`)
    const inputTextCallback = getCallbackDataByLabel(startResponses, `✍️ Input Text`)
    const photoCallback = getCallbackDataByLabel(startResponses, `🖼️ Test Photo`)
    expect(counterCallback).toBeDefined()
    expect(inputTextCallback).toBeDefined()
    expect(photoCallback).toBeDefined()

    mockServer.clearRequests()

    const counterResponses = await mockServer.sendCallbackQuery(counterCallback!, userContext)
    expect(counterResponses.length).toBeGreaterThan(0)
    expect(counterResponses[0]!.body?.text).toContain(`Current count: 0`)

    mockServer.clearRequests()

    const increaseResponses = await mockServer.sendCallbackQuery(`counter:I`, userContext)
    expect(increaseResponses.length).toBeGreaterThan(0)
    expect(increaseResponses[0]!.body?.text).toContain(`Current count: 1`)

    mockServer.clearRequests()

    const inputPageResponses = await mockServer.sendCallbackQuery(inputTextCallback!, userContext)
    expect(inputPageResponses.length).toBeGreaterThan(0)
    expect(inputPageResponses[0]!.body?.text).toContain(`Input text (with session)`)

    mockServer.clearRequests()

    const inputResultResponses = await mockServer.sendText(`Hello Flow`, userContext)
    expect(inputResultResponses.length).toBeGreaterThan(0)
    expect(inputResultResponses[0]!.body?.text).toContain(`Result`)
    expect(inputResultResponses[0]!.body?.text).toContain(`Hello Flow`)

    mockServer.clearRequests()

    const photoResponses = await mockServer.sendCallbackQuery(photoCallback!, userContext)
    expect(photoResponses.length).toBeGreaterThan(0)
    expect(mockServer.lastRequest(`editMessageMedia`) ?? mockServer.lastRequest(`sendPhoto`)).toBeDefined()

    const backCallback = getCallbackDataByLabel(photoResponses, `⬅️ Back`)
    expect(backCallback).toBeDefined()

    mockServer.clearRequests()

    const backResponses = await mockServer.sendCallbackQuery(backCallback!, userContext)
    const backMessageResponse = backResponses.find((response) => typeof response.body?.text === `string`)

    expect(backResponses.length).toBeGreaterThan(0)
    expect(backMessageResponse?.body?.text).toContain(`Welcome`)
  })
})
