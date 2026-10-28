import {beforeEach, describe, expect, it} from "bun:test"
import {e2e} from "./setup"

const intent = `username-notfound`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: UserNameNotFoundPage`, () => {
  it(`blocks user without username and shows username required page`, async () => {
    const responses = await e2e.sendText(`/start`, {
      user: {id: 77777, first_name: `NoUsername`}
    })
    const responsesId = await e2e.sendText(`/start`, {
      user: {id: 77778, first_name: `TanpaUsername`, language_code: `id`}
    })

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply).toBeDefined()
    expect(replyId).toBeDefined()
    expect(reply.method).toBe(`sendMessage`)
    expect(replyId.method).toBe(`sendMessage`)
    expect(reply.body?.text).toBe(e2e.gmsg(intent, `default`, {}))
    expect(reply.body?.text).toContain(`Username Required`)
    expect(replyId.body?.text).toBe(e2e.gmsg(intent, `default`, {}, `id`))
    expect(replyId.body?.text).toContain(`Username Diperlukan`)
    expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
    expect(e2e.extractButtonLabels(replyId)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })

  it(`allows a user with a username through the guard`, async () => {
    const responses = await e2e.sendText(`/start`, {user: {id: 77779, username: `hasusername`, language_code: `en`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.method).toBe(`sendRichMessage`)
    expect(e2e.extractText(responses[0]!)).toContain(`Welcome`)
  })
})
