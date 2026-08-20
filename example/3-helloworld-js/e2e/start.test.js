import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartPage`, () => {
  it(`respond to /start command with Hello World message`, async () => {
    const responses = await e2e.sendText(`/start`, enUser)
    const responsesId = await e2e.sendText(`/start`, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]
    const replyId = responsesId[0]
    expect(reply.body?.text).toContain(`Hello World!`)
    expect(reply.body?.text).toContain(`Time now:`)
    expect(replyId.body?.text).toContain(`Halo Dunia!`)
    expect(replyId.body?.text).toContain(`Waktu:`)
    expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(`start`, `default`, `inline`, {}))
    expect(e2e.extractButtonLabels(replyId)).toEqual(e2e.gkb(`start`, `default`, `inline`, {}, `id`))
  })

  it(`respond to callback query with edited message`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(`start`, enUser)
    const responsesId = await e2e.sendCallbackQuery(`start`, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0].body?.text).toContain(`Hello World!`)
    expect(responsesId[0].body?.text).toContain(`Halo Dunia!`)
  })

  it(`capture outbound requests`, async () => {
    const resEn = await e2e.sendText(`/start`, enUser)
    const resId = await e2e.sendText(`/start`, idUser)

    const sendMessageReq = e2e.lastCall(`sendMessage`)
    expect(sendMessageReq).toBeDefined()
    expect(resEn[0]?.body?.text).toContain(`Hello World!`)
    expect(resId[0]?.body?.text).toContain(`Halo Dunia!`)
  })

  it(`handle multiple sequential interactions`, async () => {
    const res1 = await e2e.sendText(`/start`, enUser)
    const res1Id = await e2e.sendText(`/start`, idUser)
    expect(res1[0]?.body?.text).toContain(`Hello World!`)
    expect(res1Id[0]?.body?.text).toContain(`Halo Dunia!`)

    e2e.clearCalls()

    const res2 = await e2e.sendCallbackQuery(`start`, enUser)
    const res2Id = await e2e.sendCallbackQuery(`start`, idUser)
    expect(res2[0]?.body?.text).toContain(`Hello World!`)
    expect(res2Id[0]?.body?.text).toContain(`Halo Dunia!`)

    e2e.clearCalls()

    const res3 = await e2e.sendText(`gibberish`, enUser)
    const res3Id = await e2e.sendText(`gibberish`, idUser)
    expect(res3[0]?.body?.text).toBe(e2e.gmsg(`status`, `nf`))
    expect(res3Id[0]?.body?.text).toBe(e2e.gmsg(`status`, `nf`, {}, `id`))
  })

  it(`support custom user and chat options`, async () => {
    const responses = await e2e.sendText(`/start`, {
      user: {id: 99999, first_name: `CustomUser`, username: `customuser`},
      chat: {id: 88888, type: `private`, first_name: `CustomChat`}
    })

    expect(responses[0]?.body?.text).toContain(`Hello World!`)
  })
})
