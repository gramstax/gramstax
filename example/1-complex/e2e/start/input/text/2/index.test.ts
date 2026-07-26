import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "../../../../setup"

const intent = `start-input-text-2`
// Use unique user IDs to prevent session pollution from other tests
const asUser = {user: {id: 8001}, chat: {id: 8001}}
const asUserId = {user: {id: 8002, language_code: `id`}, chat: {id: 8002}}
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: InputText2Page`, () => {
  it(`echo back unrecognized text via handleFreeText`, async () => {
    const responses = await e2e.sendText(`/unknown`, asUser)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply.body?.text).toBe(e2e.gmsg(intent, `s`, {res: `/unknown`}))
  })

  it(`show form and echo back text in session flow`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()

    const pageResponses = await e2e.sendCallbackQuery(intent, asUser)
    const pageResponsesId = await e2e.sendCallbackQuery(intent, asUserId)
    expect(pageResponses.length).toBeGreaterThan(0)
    expect(pageResponsesId.length).toBeGreaterThan(0)
    expect(pageResponses[0]!.body?.text).toBe(e2e.gmsg(intent, `i`, {}))
    expect(pageResponsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `i`, {}, `id`))
    expect(e2e.extractButtonLabels(pageResponses[0]!)).toEqual(e2e.gkb(intent, `i`, `inline`, {}))
    expect(e2e.extractButtonLabels(pageResponsesId[0]!)).toEqual(e2e.gkb(intent, `i`, `inline`, {}, `id`))

    e2e.clearCalls()

    const resultResponses = await e2e.sendText(`Echo this`, asUser)
    expect(resultResponses.length).toBeGreaterThan(0)
    expect(resultResponses[0]!.body?.text).toBe(e2e.gmsg(intent, `s`, {res: `Echo this`}))
  })
})
