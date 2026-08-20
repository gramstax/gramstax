import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../../setup"

/**
 * Use unique user IDs to prevent session pollution from other tests
 * enUser, idUser
 */

const intent = `start/input/text/2`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: InputText2Page`, () => {
  it(`echo back unrecognized text via handleFreeText`, async () => {
    const responses = await e2e.sendText(`/unknown`, enUser)
    const responsesId = await e2e.sendText(`/unknown`, idUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)

    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply.body?.text).toBe(e2e.gmsg(intent, `s`, {res: `/unknown`}))
    expect(replyId.body?.text).toBe(e2e.gmsg(intent, `s`, {res: `/unknown`}, `id`))
  })

  it(`show form and echo back text in session flow`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    const pageResponses = await e2e.sendCallbackQuery(intent, enUser)
    const pageResponsesId = await e2e.sendCallbackQuery(intent, idUser)
    expect(pageResponses.length).toBeGreaterThan(0)
    expect(pageResponsesId.length).toBeGreaterThan(0)
    expect(pageResponses[0]!.body?.text).toBe(e2e.gmsg(intent, `i`, {}))
    expect(pageResponsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `i`, {}, `id`))
    expect(e2e.extractButtonLabels(pageResponses[0]!)).toEqual(e2e.gkb(intent, `i`, `inline`, {}))
    expect(e2e.extractButtonLabels(pageResponsesId[0]!)).toEqual(e2e.gkb(intent, `i`, `inline`, {}, `id`))

    e2e.clearCalls()

    const resultResponses = await e2e.sendText(`Echo this`, enUser)
    const resultResponsesId = await e2e.sendText(`Echo this`, idUser)
    expect(resultResponses.length).toBeGreaterThan(0)
    expect(resultResponsesId.length).toBeGreaterThan(0)
    expect(resultResponses[0]!.body?.text).toBe(e2e.gmsg(intent, `s`, {res: `Echo this`}))
    expect(resultResponsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `s`, {res: `Echo this`}, `id`))
  })
})
