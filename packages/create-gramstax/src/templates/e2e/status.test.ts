import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

const intent = `status`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StatusPage`, () => {
  it(`show 'Route not found' for unrecognized callback query`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(`nonexistent-callback-data`, enUser)
    const responsesId = await e2e.sendCallbackQuery(`nonexistent-callback-data`, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply).toBeDefined()
    expect(replyId).toBeDefined()
    expect(reply.method).toBe(`editMessageText`)
    expect(replyId.method).toBe(`editMessageText`)
    expect(reply.body?.text).toBe(e2e.gmsg(intent, `nf`))
    expect(replyId.body?.text).toBe(e2e.gmsg(intent, `nf`, {}, `id`))
  })

  it(`show 'Route not found' for an unknown command`, async () => {
    const responses = await e2e.sendText(`/does-not-exist`, {user: {id: 93001, username: `unknowncommand`, language_code: `en`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.method).toBe(`sendMessage`)
    expect(e2e.extractText(responses[0]!)).toBe(e2e.gmsg(intent, `nf`))
  })

  it(`show 'Route not found' for unknown free text`, async () => {
    const responses = await e2e.sendText(`hello`, {user: {id: 93002, username: `unknownText`, language_code: `en`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.method).toBe(`sendMessage`)
    expect(e2e.extractText(responses[0]!)).toBe(e2e.gmsg(intent, `nf`))
  })
})
