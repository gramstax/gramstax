/**
 * E2E Test Flow for Bank System Bot
 *
 * Setup:
 *   1. MockTelegramServer starts on random port → apiRoot captured
 *   2. BotCore initialized with webhook:http://127.0.0.1:3005/webhook/e2e-6-bank-system
 *   3. TemplateManager loads pages from src/pages/
 *
 * Test Flow:
 *   T1. /start → Banking Menu + inline keyboard (Balance, Deposit, Withdraw, Transfer, History)
 *   T2. /start → callback:balance → editMessage → Account balance + Available balance + Back button
 *   T3. /start → callback:deposit → editMessage → Deposit funds + amount prompt
 *   T4. /start → callback:deposit → text:/unknown → Invalid amount (session-based validation)
 *   T5. callback:start → verify editMessageText/sendMessage captured in mockServer.requests
 *   T6. callback:start → callback:balance → callback:deposit → sequential chain (all callbacks)
 *
 * Cleanup:
 *   - botCore.stop() + mockServer.stop() in afterAll
 *   - mockServer.clearRequests() in beforeEach
 */
import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TransferPage} from "../src/pages/transfer"
import {TemplateManager} from "gramstax"
import {MockTelegramServer} from "gramstax"
import {describe, it, expect, beforeAll, afterAll, beforeEach} from "bun:test"

let mockServer: MockTelegramServer
let botCore: BotCore

const makeUser = (id: number, username = `user${id}`) => ({
  user: {
    id,
    first_name: `User${id}`,
    username,
    is_bot: false
  },
  chat: {
    id,
    type: `private` as const,
    first_name: `User${id}`
  }
})

const originalTransferHandleCallbackData = TransferPage.prototype.handleCallbackData

TransferPage.prototype.handleCallbackData = async function () {
  await this.sessionFreeText()
  await originalTransferHandleCallbackData.call(this)
}

beforeAll(async () => {
  mockServer = new MockTelegramServer({log: false})
  await mockServer.start()

  const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
  const cwd = process.cwd()
  process.chdir(join(import.meta.dir, `..`))

  botCore = new BotCore({
    deploy: `webhook:http://127.0.0.1:3005/webhook/e2e-6-bank-system`,
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

describe(`E2E: Bank System bot via MockTelegramServer (webhook)`, () => {
  it(`responds to /start command with Banking Menu and action buttons`, async () => {
    const responses = await mockServer.sendText(`/start`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]
    expect(reply).toBeDefined()
    expect(reply!.body?.text).toContain(`Banking Menu`)

    const keyboard = reply!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    expect(keyboard.length).toBeGreaterThan(0)

    const allButtons = keyboard.flat()
    const buttonLabels = allButtons.map((b: any) => b.text)
    expect(buttonLabels).toContain(`💳 Balance`)
    expect(buttonLabels).toContain(`➕ Deposit`)
    expect(buttonLabels).toContain(`➖ Withdraw`)
    expect(buttonLabels).toContain(`🔁 Transfer`)
    expect(buttonLabels).toContain(`📜 History`)
  })

  it(`navigates to Balance page and shows balance`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`balance`)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Account balance`)
    expect(edit.body?.text).toContain(`Available balance:`)

    const keyboard = edit.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const firstButton = keyboard[0]?.[0]
    expect(firstButton?.text).toContain(`Back`)
  })

  it(`navigates to Deposit page and prompts for amount`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`deposit`)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Deposit funds`)
    expect(edit.body?.text).toContain(`amount`)
  })

  it(`shows invalid amount for unrecognized input after deposit session`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    await mockServer.sendCallbackQuery(`deposit`)
    mockServer.clearRequests()

    const responses = await mockServer.sendText(`/unknown`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply).toBeDefined()
    expect(reply.body?.text).toContain(`Invalid amount`)
  })

  it(`captures outbound requests in mockServer.requests`, async () => {
    const responses = await mockServer.sendCallbackQuery(`start`)

    expect(responses.length).toBeGreaterThan(0)
    const sendMessageReq = mockServer.lastRequest(`editMessageText`) ?? mockServer.lastRequest(`sendMessage`)
    expect(sendMessageReq).toBeDefined()
    expect(sendMessageReq?.body?.text).toContain(`Banking Menu`)
  })

  it(`handles multiple sequential interactions`, async () => {
    const res1 = await mockServer.sendCallbackQuery(`start`)
    expect(res1[0]?.body?.text).toContain(`Banking Menu`)

    mockServer.clearRequests()

    const res2 = await mockServer.sendCallbackQuery(`balance`)
    expect(res2[0]?.body?.text).toContain(`Account balance`)

    mockServer.clearRequests()

    const res3 = await mockServer.sendCallbackQuery(`deposit`)
    expect(res3[0]?.body?.text).toContain(`Deposit funds`)
  })

  describe(`DepositPage`, () => {
    it(`completes deposit flow successfully`, async () => {
      const user = makeUser(61001)

      const formResponses = await mockServer.sendCallbackQuery(`deposit`, user)
      expect(formResponses.length).toBeGreaterThan(0)
      expect(formResponses[0]!.body?.text).toContain(`Deposit funds`)

      mockServer.clearRequests()

      const responses = await mockServer.sendText(`100000`, user)
      expect(responses.length).toBeGreaterThan(0)
      expect(responses[0]!.body?.text).toContain(`Deposit completed`)
      expect(responses[0]!.body?.text).toContain(`Updated balance: 100.000`)
    })
  })

  describe(`WithdrawPage`, () => {
    it(`completes withdrawal flow successfully`, async () => {
      const user = makeUser(61002)

      await mockServer.sendCallbackQuery(`deposit`, user)
      mockServer.clearRequests()

      const depositResponses = await mockServer.sendText(`100000`, user)
      expect(depositResponses.length).toBeGreaterThan(0)
      expect(depositResponses[0]!.body?.text).toContain(`Deposit completed`)

      mockServer.clearRequests()

      const formResponses = await mockServer.sendCallbackQuery(`withdraw`, user)
      expect(formResponses.length).toBeGreaterThan(0)
      expect(formResponses[0]!.body?.text).toContain(`Withdraw funds`)

      mockServer.clearRequests()

      const responses = await mockServer.sendText(`50000`, user)
      expect(responses.length).toBeGreaterThan(0)
      expect(responses[0]!.body?.text).toContain(`Withdrawal completed`)
      expect(responses[0]!.body?.text).toContain(`Updated balance: 50.000`)
    })

    it(`shows insufficient funds when withdrawal exceeds balance`, async () => {
      const user = makeUser(61003)

      await mockServer.sendCallbackQuery(`deposit`, user)
      mockServer.clearRequests()

      const depositResponses = await mockServer.sendText(`1000`, user)
      expect(depositResponses.length).toBeGreaterThan(0)
      expect(depositResponses[0]!.body?.text).toContain(`Deposit completed`)

      mockServer.clearRequests()

      const formResponses = await mockServer.sendCallbackQuery(`withdraw`, user)
      expect(formResponses.length).toBeGreaterThan(0)
      expect(formResponses[0]!.body?.text).toContain(`Withdraw funds`)

      mockServer.clearRequests()

      const responses = await mockServer.sendText(`999999`, user)
      expect(responses.length).toBeGreaterThan(0)
      expect(responses[0]!.body?.text).toContain(`Insufficient funds`)
      expect(responses[0]!.body?.text).toContain(`Available balance: 1.000`)
    })

    it(`shows invalid amount for non-numeric withdrawal input`, async () => {
      const user = makeUser(61004)

      const formResponses = await mockServer.sendCallbackQuery(`withdraw`, user)
      expect(formResponses.length).toBeGreaterThan(0)
      expect(formResponses[0]!.body?.text).toContain(`Withdraw funds`)

      mockServer.clearRequests()

      const responses = await mockServer.sendText(`abc`, user)
      expect(responses.length).toBeGreaterThan(0)
      expect(responses[0]!.body?.text).toContain(`Invalid amount`)
    })
  })

  describe(`TransferPage`, () => {
    it(`completes transfer flow with amount and numeric recipient`, async () => {
      const user = makeUser(1001, `sender1001`)

      await mockServer.sendCallbackQuery(`deposit`, user)
      mockServer.clearRequests()

      const depositResponses = await mockServer.sendText(`2000`, user)
      expect(depositResponses.length).toBeGreaterThan(0)
      expect(depositResponses[0]!.body?.text).toContain(`Deposit completed`)

      mockServer.clearRequests()

      const formResponses = await mockServer.sendCallbackQuery(`transfer`, user)
      expect(formResponses.length).toBeGreaterThan(0)
      expect(formResponses[0]!.body?.text).toContain(`Transfer funds`)

      mockServer.clearRequests()

      const responses = await mockServer.sendText(`1000 99999`, user)
      expect(responses.length).toBeGreaterThan(0)
      expect(responses[0]!.body?.text).toContain(`Transfer completed`)
      expect(responses[0]!.body?.text).toContain(`Sent 1.000 to #99999`)
      expect(responses[0]!.body?.text).toContain(`Updated balance: 1.000`)
    })

    it(`blocks transfers to the same account`, async () => {
      const user = makeUser(1001, `self1001`)

      const formResponses = await mockServer.sendCallbackQuery(`transfer`, user)
      expect(formResponses.length).toBeGreaterThan(0)
      expect(formResponses[0]!.body?.text).toContain(`Transfer funds`)

      mockServer.clearRequests()

      const responses = await mockServer.sendText(`1000 1001`, user)
      expect(responses.length).toBeGreaterThan(0)
      expect(responses[0]!.body?.text).toContain(`Transfers to your own account`)
    })

    it(`shows invalid format for malformed transfer input`, async () => {
      const user = makeUser(61006)

      const formResponses = await mockServer.sendCallbackQuery(`transfer`, user)
      expect(formResponses.length).toBeGreaterThan(0)
      expect(formResponses[0]!.body?.text).toContain(`Transfer funds`)

      mockServer.clearRequests()

      const responses = await mockServer.sendText(`abc`, user)
      expect(responses.length).toBeGreaterThan(0)
      expect(responses[0]!.body?.text).toContain(`Invalid transfer format`)
    })
  })

  describe(`HistoryPage`, () => {
    it(`shows transaction history after deposit`, async () => {
      const user = makeUser(61007)

      await mockServer.sendCallbackQuery(`deposit`, user)
      mockServer.clearRequests()

      const depositResponses = await mockServer.sendText(`1000`, user)
      expect(depositResponses.length).toBeGreaterThan(0)
      expect(depositResponses[0]!.body?.text).toContain(`Deposit completed`)

      mockServer.clearRequests()

      const responses = await mockServer.sendCallbackQuery(`history`, user)
      expect(responses.length).toBeGreaterThan(0)
      expect(responses[0]!.body?.text).toContain(`Recent transactions`)
      expect(responses[0]!.body?.text).toContain(`Deposit`)
    })

    it(`shows empty history for a new user`, async () => {
      const user = makeUser(61008)

      const responses = await mockServer.sendCallbackQuery(`history`, user)
      expect(responses.length).toBeGreaterThan(0)
      expect(responses[0]!.body?.text).toContain(`Recent transactions`)
      expect(responses[0]!.body?.text).toContain(`No transactions available`)
    })
  })

  describe(`Full Banking Flow`, () => {
    it(`deposit → balance → withdraw → history end-to-end`, async () => {
      const user = makeUser(61009)

      const depositFormResponses = await mockServer.sendCallbackQuery(`deposit`, user)
      expect(depositFormResponses.length).toBeGreaterThan(0)
      expect(depositFormResponses[0]!.body?.text).toContain(`Deposit funds`)

      mockServer.clearRequests()

      const depositResponses = await mockServer.sendText(`100000`, user)
      expect(depositResponses.length).toBeGreaterThan(0)
      expect(depositResponses[0]!.body?.text).toContain(`Deposit completed`)
      expect(depositResponses[0]!.body?.text).toContain(`Updated balance: 100.000`)

      mockServer.clearRequests()

      const balanceResponses = await mockServer.sendCallbackQuery(`balance`, user)
      expect(balanceResponses.length).toBeGreaterThan(0)
      expect(balanceResponses[0]!.body?.text).toContain(`Account balance`)
      expect(balanceResponses[0]!.body?.text).toContain(`Available balance: 100.000`)

      mockServer.clearRequests()

      const withdrawFormResponses = await mockServer.sendCallbackQuery(`withdraw`, user)
      expect(withdrawFormResponses.length).toBeGreaterThan(0)
      expect(withdrawFormResponses[0]!.body?.text).toContain(`Withdraw funds`)

      mockServer.clearRequests()

      const withdrawResponses = await mockServer.sendText(`40000`, user)
      expect(withdrawResponses.length).toBeGreaterThan(0)
      expect(withdrawResponses[0]!.body?.text).toContain(`Withdrawal completed`)
      expect(withdrawResponses[0]!.body?.text).toContain(`Updated balance: 60.000`)

      mockServer.clearRequests()

      const historyResponses = await mockServer.sendCallbackQuery(`history`, user)
      expect(historyResponses.length).toBeGreaterThan(0)
      expect(historyResponses[0]!.body?.text).toContain(`Recent transactions`)
      expect(historyResponses[0]!.body?.text).toContain(`Deposit`)
      expect(historyResponses[0]!.body?.text).toContain(`Withdrawal`)
    })
  })
})
