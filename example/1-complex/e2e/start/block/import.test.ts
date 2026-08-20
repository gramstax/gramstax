import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/block/import`
const originalRandom = Math.random
beforeEach(() => {
  e2e.clearCalls()
})
afterEach(() => {
  Math.random = originalRandom
})
describe(`E2E: BlockImportPage`, () => {
  it(`show block import demo with random value`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    Math.random = () => 1 // overrides math.random()
    const responses = await e2e.sendCallbackQuery(intent, enUser)
    const responsesId = await e2e.sendCallbackQuery(intent, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {number: Math.random()}))
    expect(responsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {number: Math.random()}, `id`))
  })
})
