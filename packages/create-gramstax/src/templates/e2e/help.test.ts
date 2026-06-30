import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `help`
const asUser = {user: {id: 7001, username: `testuser`}, chat: {id: 7001}}

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: HelpPage`, () => {
  it(`show help text when navigating from /start -> Help`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, asUser)
    const responsesId = await e2e.sendCallbackQuery(intent, {user: {id: 7002, username: `pengguna`, language_code: `id`}, chat: {id: 7002}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const edit = responses[0]!
    const editId = responsesId[0]!
    expect(edit.body?.text).toBe(e2e.gmsg(intent, `s1`, {}))
    expect(editId.body?.text).toBe(e2e.gmsg(intent, `s1`, {}, `id`))
    expect(e2e.buttonLabels(edit)).toEqual(e2e.gkb(intent, `s1`, `inline`, {}))
    expect(e2e.buttonLabels(editId)).toEqual(e2e.gkb(intent, `s1`, `inline`, {}, `id`))
  })
})
