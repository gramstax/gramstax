import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../setup"

const intent = `start/stream`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: StartStreamPage`, () => {
  it(`send streaming markdown via replyWithStream`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    // replyWithStream awaits the full async generator, so all stream chunks
    // are captured synchronously within handleUpdate (~2.5s total sleep per user)
    // Stream plugin uses sendMessageDraft for chunks and sendMessage for the final message
    const responses = await e2e.sendCallbackQuery(intent, enUser)
    const responsesId = await e2e.sendCallbackQuery(intent, idUser)
    const firstCalls = responses.filter((r) => r.method === `sendMessageDraft` || r.method === `sendMessage`)
    const firstCallsId = responsesId.filter((r) => r.method === `sendMessageDraft` || r.method === `sendMessage`)
    const finalCall = responses.find((r) => r.method === `sendMessage`)
    const finalCallId = responsesId.find((r) => r.method === `sendMessage`)

    expect(firstCalls.length).toBeGreaterThan(0)
    expect(firstCallsId.length).toBeGreaterThan(0)
    expect(firstCalls[0]!.body?.text).toContain(`Generating`)
    expect(firstCallsId[0]!.body?.text).toContain(`Generating`)
    expect(finalCall).toBeDefined()
    expect(finalCallId).toBeDefined()
  }, 15000)
})
