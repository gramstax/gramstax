import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `block-switch`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: BlockSwitchPage`, () => {
  it(`show initial switch state as Inactive (status 0)`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent)
    const responsesId = await e2e.sendCallbackQuery(intent, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {status: `0`}))
    expect(responsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {status: `0`}, `id`))
    expect(e2e.buttonLabels(responses[0]!)).toEqual(e2e.gkb(intent, `s1`, `inline`, {status: `0`}))
    expect(e2e.buttonLabels(responsesId[0]!)).toEqual(e2e.gkb(intent, `s1`, `inline`, {status: `0`}, `id`))
  })

  it(`toggle switch to Active (status 1)`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(`${intent}:s1:1`)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {status: `1`}))
    expect(e2e.buttonLabels(responses[0]!)).toEqual(e2e.gkb(intent, `s1`, `inline`, {status: `1`}))
  })

  it(`toggle back to Inactive (status 0)`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent)
    e2e.clearCalls()
    await e2e.sendCallbackQuery(`${intent}:s1:1`)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(`${intent}:s1:0`)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {status: `0`}))
    expect(e2e.buttonLabels(responses[0]!)).toEqual(e2e.gkb(intent, `s1`, `inline`, {status: `0`}))
  })
})
