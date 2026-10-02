import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/block/map`
const originalRandom = Math.random
beforeEach(() => {
  e2e.clearCalls()
})
afterEach(() => {
  Math.random = originalRandom
})
describe(`E2E: BlockMapPage`, () => {
  it(`show template map demo with one deterministic map expansion`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    Math.random = () => 1 // overrides math.random(), so the page builds a 7-item arr of {number: 1}
    const responses = await e2e.sendCallbackQuery(intent, enUser)
    const responsesId = await e2e.sendCallbackQuery(intent, idUser)

    const da = {
      arr: Array.from({length: 7}, () => ({number: 1})),
      status: 1,
      e: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`,
      i: `It will not work if accessed inside the &lt;map&gt; block. Change it first with the "as" and "index" attributes in &lt;map&gt;`
    }

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, da))
    expect(responsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, da, `id`))
    expect(e2e.extractButtonLabels(responses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, da))
    expect(e2e.extractButtonLabels(responsesId[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, da, `id`))
  })
})
