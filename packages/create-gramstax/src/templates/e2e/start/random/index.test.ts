import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/random`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartRandomPage (hub)`, () => {
  it(`show hub menu when navigating from /start`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, enUser)
    const responsesId = await e2e.sendCallbackQuery(intent, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const edit = responses[0]!
    const editId = responsesId[0]!
    expect(edit.method).toBe(`editMessageText`)
    expect(edit.body?.text).toContain(`Random Generator`)
    expect(editId.method).toBe(`editMessageText`)
    expect(editId.body?.text).toContain(`Generator Acak`)
    expect(e2e.extractButtonLabels(edit)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
    expect(e2e.extractButtonLabels(editId)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })
})
