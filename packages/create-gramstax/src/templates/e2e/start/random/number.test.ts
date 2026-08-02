import {beforeEach, describe, expect, it} from "bun:test"
import {e2e} from "../../setup"

const intent = `start/random/number`
const asUser = {user: {id: 8002, username: `testuser`}}

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartRandomNumberPage`, () => {
  it(`show generated random number when navigating from hub`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(`start/random`, asUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, asUser)
    const responsesId = await e2e.sendCallbackQuery(intent, {
      user: {id: 8002, username: `pengguna`, language_code: `id`}
    })

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const edit = responses[0]!
    const editId = responsesId[0]!
    expect(edit.body?.text).toContain(`Random Number`)
    expect(editId.body?.text).toContain(`Angka Acak`)
    expect(e2e.extractButtonLabels(edit)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
    expect(e2e.extractButtonLabels(editId)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })
})
