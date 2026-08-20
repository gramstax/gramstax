import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../../setup"

const intent = `start/input/text`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: InputTextPage`, () => {
  it(`show input form and echo back user text`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    // Navigate to input-text
    const pageResponses = await e2e.sendCallbackQuery(intent, enUser)
    const pageResponsesId = await e2e.sendCallbackQuery(intent, idUser)
    expect(pageResponses.length).toBeGreaterThan(0)
    expect(pageResponsesId.length).toBeGreaterThan(0)
    expect(pageResponses[0]!.body?.text).toBe(e2e.gmsg(intent, `i`, {}))
    expect(pageResponsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `i`, {}, `id`))
    expect(e2e.extractButtonLabels(pageResponses[0]!)).toEqual(e2e.gkb(intent, `i`, `inline`, {}))
    expect(e2e.extractButtonLabels(pageResponsesId[0]!)).toEqual(e2e.gkb(intent, `i`, `inline`, {}, `id`))

    e2e.clearCalls()

    // Send text
    const resultResponses = await e2e.sendText(`Hello World`, enUser)
    const resultResponsesId = await e2e.sendText(`Hello World`, idUser)
    expect(resultResponses.length).toBeGreaterThan(0)
    expect(resultResponsesId.length).toBeGreaterThan(0)
    expect(resultResponses[0]!.body?.text).toBe(e2e.gmsg(intent, `s`, {res: `Hello World`}))
    expect(resultResponsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `s`, {res: `Hello World`}, `id`))
    expect(e2e.extractButtonLabels(resultResponses[0]!)).toEqual(e2e.gkb(intent, `s`, `inline`, {}))
    expect(e2e.extractButtonLabels(resultResponsesId[0]!)).toEqual(e2e.gkb(intent, `s`, `inline`, {}, `id`))
  })
})
