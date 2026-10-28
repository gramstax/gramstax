import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/random/number`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartRandomNumberPage`, () => {
  it(`show generated random number when navigating from hub`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(`start/random`, enUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, enUser)
    const responsesId = await e2e.sendCallbackQuery(intent, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const edit = responses[0]!
    const editId = responsesId[0]!
    expect(edit.method).toBe(`editMessageText`)
    expect(editId.method).toBe(`editMessageText`)
    expect(edit.body?.text).toContain(`Random Number`)
    expect(editId.body?.text).toContain(`Angka Acak`)
    expect(e2e.extractButtonLabels(edit)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
    expect(e2e.extractButtonLabels(editId)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })
})
