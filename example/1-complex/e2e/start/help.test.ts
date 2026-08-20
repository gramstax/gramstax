import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../setup"

const intent = `start/help`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: HelpPage`, () => {
  it(`show help text when navigating from /start -> Help`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, enUser)
    const responsesId = await e2e.sendCallbackQuery(intent, idUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)

    const edit = responses[0]!
    const editId = responsesId[0]!
    expect(edit.body?.text).toBe(e2e.gmsg(intent, `default`, {}))
    expect(editId.body?.text).toBe(e2e.gmsg(intent, `default`, {}, `id`))
    expect(e2e.extractButtonLabels(edit)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
    expect(e2e.extractButtonLabels(editId)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })
})
