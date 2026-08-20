import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/block/switch`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: BlockSwitchPage`, () => {
  it(`show initial switch state as Inactive (status 0)`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, enUser)
    const responsesId = await e2e.sendCallbackQuery(intent, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {status: `0`}))
    expect(responsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {status: `0`}, `id`))
    expect(e2e.extractButtonLabels(responses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {status: `0`}))
    expect(e2e.extractButtonLabels(responsesId[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {status: `0`}, `id`))
  })

  it(`toggle switch to Active (status 1)`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent, enUser)
    await e2e.sendCallbackQuery(intent, idUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(`${intent}:1`, enUser)
    const responsesId = await e2e.sendCallbackQuery(`${intent}:1`, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {status: `1`}))
    expect(responsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {status: `1`}, `id`))
    expect(e2e.extractButtonLabels(responses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {status: `1`}))
    expect(e2e.extractButtonLabels(responsesId[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {status: `1`}, `id`))
  })

  it(`toggle back to Inactive (status 0)`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent, enUser)
    await e2e.sendCallbackQuery(intent, idUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(`${intent}:1`, enUser)
    await e2e.sendCallbackQuery(`${intent}:1`, idUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(`${intent}:0`, enUser)
    const responsesId = await e2e.sendCallbackQuery(`${intent}:0`, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {status: `0`}))
    expect(responsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {status: `0`}, `id`))
    expect(e2e.extractButtonLabels(responses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {status: `0`}))
    expect(e2e.extractButtonLabels(responsesId[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {status: `0`}, `id`))
  })
})
