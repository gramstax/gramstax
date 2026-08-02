import {beforeEach, describe, expect, it } from "bun:test"
import {e2e} from "./setup"

beforeEach(() => e2e.clearCalls())
describe(`E2E: StartPage`, () => {
  it(`respond to /start with store menu`, async () => {
    const res = await e2e.sendText(`/start`)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`SubStore Bot`)
  })
  it(`show ID variant`, async () => {
    const res = await e2e.sendText(`/start`, {user: {language_code: `id`}})
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Bot SubStore`)
  })
})
