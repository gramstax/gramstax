import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, resetEnv, type TestEnvironment, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `start`

let userIdCounter = Date.now()
function freshUser(lang?: string) {
  userIdCounter++
  const id = userIdCounter
  return lang ? {user: {id, language_code: lang}, chat: {id}} : {user: {id}, chat: {id}}
}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(async () => {
  await resetEnv()
})

describe(`E2E: StartPage`, () => {
  it(`responds to /start with newsletter hub and subscription status`, async () => {
    const user = freshUser()
    const userId = freshUser(`id`)
    const responses = await env.mockServer.sendText(`/start`, user)
    const responsesId = await env.mockServer.sendText(`/start`, userId)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Newsletter Hub`)
    expect(responsesId[0]!.body?.text).toContain(`Pusat Newsletter`)
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `s1`, `inline`, {subscribed: false}))
    expect(buttonLabels(responsesId[0])).toEqual(gkb(intent, `s1`, `inline`, {subscribed: false}, `id`))
  })

  it(`toggles subscription status via callback`, async () => {
    const user = freshUser()
    const res1 = await env.mockServer.sendText(`/start`, user)
    expect(res1[0]!.body?.text).toContain(`Not subscribed`)

    env.clearRequests()

    const res2 = await env.mockServer.sendCallbackQuery(`start:s1`, user)
    expect(res2.length).toBeGreaterThan(0)
    expect(res2[0]!.body?.text).toContain(`Subscribed`)
  })
})
