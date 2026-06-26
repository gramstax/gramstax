import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `username-notfound`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: UserNameNotFoundPage`, () => {
  it(`blocks user without username and shows username required page`, async () => {
    const responses = await env.mockServer.sendText(`/start`, {
      user: {id: 77777, first_name: `NoUsername`},
      chat: {id: 77777, type: `private`, first_name: `NoUsername`}
    })

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply).toBeDefined()
    expect(reply.body?.text).toBe(msg(intent, `s1`, {}))
    expect(reply.body?.text).toContain(`Username Required`)
    expect(buttonLabels(reply)).toEqual(kb(intent, `s1`, `inline`, {}))
  })
})
