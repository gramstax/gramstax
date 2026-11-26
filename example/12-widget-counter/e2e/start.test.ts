import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartPage`, () => {
  it(`sends the counter widget on /start`, async () => {
    const res = await e2e.sendText(`/start`, enUser)
    const resId = await e2e.sendText(`/start`, idUser)
    expect(res.length).toBeGreaterThan(0)
    expect(resId.length).toBeGreaterThan(0)
    const call = res.find((c) => c.method === `sendWidget`)
    const callId = resId.find((c) => c.method === `sendWidget`)
    expect(call).toBeDefined()
    expect(callId).toBeDefined()
    expect(call!.body?.chat_data).toBe(`{"count": 0}`)
    expect(call!.body?.allow_queries).toBe(true)
    expect(call!.body?.parse_mode).toBe(`HTML`)
    expect(call!.body?.width).toBe(400)
    expect(call!.body?.height).toBe(200)
    expect(call!.body?.caption).toContain(`Tap counter`)
    expect(callId!.body?.caption).toContain(`Penghitung ketuk`)
    expect(call!.body?.html).toContain(`chatDataChanged`)
    expect(call!.body?.html).toContain(`W.request('tap:'`)
  })
})
