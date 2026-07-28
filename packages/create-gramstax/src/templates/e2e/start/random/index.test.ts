import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "../../setup"

const intent = `start/random`
const asUser = {user: {id: 9001, username: `testuser`}, chat: {id: 9001}}

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartRandomPage (hub)`, () => {
  it(`show hub menu when navigating from /start`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, asUser)
    const responsesId = await e2e.sendCallbackQuery(intent, {user: {id: 9002, username: `pengguna`, language_code: `id`}, chat: {id: 9002}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const edit = responses[0]!
    const editId = responsesId[0]!
    expect(edit.body?.rich_message.html).toContain(`Random Generator`)
    expect(editId.body?.rich_message.html).toContain(`Generator Acak`)
    expect(e2e.extractButtonLabels(edit)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
    expect(e2e.extractButtonLabels(editId)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })
})
