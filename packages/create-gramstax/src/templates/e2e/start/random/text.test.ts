import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/random/text`
const frUser = {user: {id: 4301, username: `utilisateur`, language_code: `fr`}}

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartRandomTextPage`, () => {
  it(`show random text when navigating from hub`, async () => {
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
    expect(edit.body?.text).toContain(`Random Text`)
    expect(editId.body?.text).toContain(`Teks Acak`)
    expect(e2e.extractButtonLabels(edit)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
    expect(e2e.extractButtonLabels(editId)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })

  it(`falls back to English text for an unsupported language`, async () => {
    const responses = await e2e.sendCallbackQuery(intent, frUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.method).toBe(`editMessageText`)
    expect(e2e.extractText(responses[0]!)).toContain(`Random Text`)
    expect(e2e.extractText(responses[0]!)).not.toContain(`Teks Acak`)
    expect(e2e.extractButtonLabels(responses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
  })
})
