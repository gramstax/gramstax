import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `username-notfound`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: UserNameNotFoundPage`, () => {
  it(`blocks user without username and shows username required page`, async () => {
    const responses = await e2e.sendText(`/start`, {
      user: {id: 77777, first_name: `NoUsername`},
      chat: {id: 77777, type: `private`, first_name: `NoUsername`}
    })

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply).toBeDefined()
    expect(reply.body?.text).toBe(e2e.gmsg(intent, `s1`, {}))
    expect(reply.body?.text).toContain(`Username Required`)
    expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(intent, `s1`, `inline`, {}))
  })
})
