import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

const intent = `help`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: HelpPage`, () => {
  it(`show help text when navigating from /start -> Help`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, enUser)
    const responsesId = await e2e.sendCallbackQuery(intent, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const edit = responses[0]!
    const editId = responsesId[0]!
    expect(edit.method).toBe(`editMessageText`)
    expect(editId.method).toBe(`editMessageText`)
    expect(edit.body?.rich_message.html).toBe(e2e.gmsg(intent, `default`, {}))
    expect(editId.body?.rich_message.html).toBe(e2e.gmsg(intent, `default`, {}, `id`))
    expect(e2e.extractButtonLabels(edit)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
    expect(e2e.extractButtonLabels(editId)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })

  it(`answers the /help command`, async () => {
    const responses = await e2e.sendText(`/help`, enUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.method).toBe(`sendRichMessage`)
    expect(e2e.extractText(responses[0]!)).toBe(e2e.gmsg(intent, `default`, {}))
    expect(e2e.extractButtonLabels(responses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
  })
})
