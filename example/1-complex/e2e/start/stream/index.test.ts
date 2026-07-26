import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "../../setup"

const intent = `start/stream`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: StartStreamPage`, () => {
  it(`send streaming markdown via replyWithStream`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    // replyWithStream awaits the full async generator, so all stream chunks
    // are captured synchronously within handleUpdate (~2.5s total sleep)
    // Stream plugin uses sendMessageDraft for the first chunk and sendMessage/editMessageText for progress
    const responses = await e2e.sendCallbackQuery(intent)
    const firstCalls = responses.filter((r) => r.method === `sendMessageDraft` || r.method === `sendMessage`)
    const editCalls = responses.filter((r) => r.method === `editMessageText`)

    expect(firstCalls.length).toBeGreaterThan(0)
    expect(firstCalls[0]!.body?.text).toContain(`Generating`)
    expect(editCalls.length).toBeGreaterThan(0)
  })
})
