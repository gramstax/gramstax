import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser, sendWidgetQuery} from "./setup"

beforeEach(async () => {
  await e2e.sendText(`/start`, enUser)
  e2e.clearCalls()
})

describe(`E2E: widget tap`, () => {
  it(`answers the tap and pushes count 1 via update-data`, async () => {
    const res = await sendWidgetQuery(`tap:0`, enUser)
    expect(res.length).toBeGreaterThan(0)
    const answer = res.find((c) => c.method === `answerWidgetQuery`)
    const edit = res.find((c) => c.method === `editMessageWidgetData`)
    expect(answer).toBeDefined()
    expect(answer!.body?.data).toBe(`Counted!`)
    expect(edit).toBeDefined()
    expect(edit!.body?.chat_id).toBe(4001)
    expect(edit!.body?.message_id).toBe(101)
    expect(edit!.body?.chat_data).toBe(`{"count": 1}`)
    expect(res.indexOf(answer!)).toBeLessThan(res.indexOf(edit!))
  })

  it(`counts up on consecutive taps`, async () => {
    await sendWidgetQuery(`tap:0`, enUser)
    e2e.clearCalls()
    const res = await sendWidgetQuery(`tap:1`, enUser)
    const edit = res.find((c) => c.method === `editMessageWidgetData`)
    expect(edit!.body?.chat_data).toBe(`{"count": 2}`)
  })

  it(`answers in the user's language`, async () => {
    const res = await sendWidgetQuery(`tap:4`, idUser)
    const answer = res.find((c) => c.method === `answerWidgetQuery`)
    expect(answer!.body?.data).toBe(`Terhitung!`)
    const edit = res.find((c) => c.method === `editMessageWidgetData`)
    expect(edit!.body?.chat_id).toBe(5001)
    expect(edit!.body?.chat_data).toBe(`{"count": 5}`)
  })

  it(`answers a malformed tap without pushing state`, async () => {
    const res = await sendWidgetQuery(`bogus`, enUser)
    const answer = res.find((c) => c.method === `answerWidgetQuery`)
    expect(answer).toBeDefined()
    expect(answer!.body?.data).toBe(`Counted!`)
    expect(res.find((c) => c.method === `editMessageWidgetData`)).toBeUndefined()
  })
})
