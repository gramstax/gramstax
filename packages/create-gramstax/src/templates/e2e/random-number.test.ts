import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `random-number`
const asUser = {user: {id: 2003, username: `testuser`}, chat: {id: 2003}}

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: RandomNumberPage`, () => {
  it(`show generated random number when navigating from /start`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, asUser)
    const responsesId = await e2e.sendCallbackQuery(intent, {user: {id: 6001, username: `pengguna`, language_code: `id`}, chat: {id: 6001}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const edit = responses[0]!
    const editId = responsesId[0]!
    expect(edit.body?.text).toContain(`Random Number`)
    expect(editId.body?.text).toContain(`Angka Acak`)
    expect(e2e.buttonLabels(edit)).toEqual(e2e.gkb(intent, `s1`, `inline`, {}))
    expect(e2e.buttonLabels(editId)).toEqual(e2e.gkb(intent, `s1`, `inline`, {}, `id`))
  })
})
