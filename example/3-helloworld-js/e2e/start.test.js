import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup.js"

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartPage`, () => {
  it(`respond to /start command with Hello World message`, async () => {
    const responses = await e2e.sendText(`/start`)
    const responsesId = await e2e.sendText(`/start`, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]
    const replyId = responsesId[0]
    expect(reply.body?.text).toContain(`Hello World!`)
    expect(reply.body?.text).toContain(`Time now:`)
    expect(replyId.body?.text).toContain(`Halo Dunia!`)
    expect(replyId.body?.text).toContain(`Waktu:`)
    expect(e2e.buttonLabels(reply)).toEqual(e2e.gkb(`start`, `s1`, `inline`, {}))
    expect(e2e.buttonLabels(replyId)).toEqual(e2e.gkb(`start`, `s1`, `inline`, {}, `id`))
  })

  it(`respond to callback query with edited message`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(`start`)
    const responsesId = await e2e.sendCallbackQuery(`start`, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0].body?.text).toContain(`Hello World!`)
    expect(responsesId[0].body?.text).toContain(`Halo Dunia!`)
  })

  it(`capture outbound requests`, async () => {
    await e2e.sendText(`/start`)

    const sendMessageReq = e2e.lastCall(`sendMessage`)
    expect(sendMessageReq).toBeDefined()
    expect(sendMessageReq.body?.text).toContain(`Hello World!`)
  })

  it(`handle multiple sequential interactions`, async () => {
    const res1 = await e2e.sendText(`/start`)
    expect(res1[0]?.body?.text).toContain(`Hello World!`)

    e2e.clearCalls()

    const res2 = await e2e.sendCallbackQuery(`start`)
    expect(res2[0]?.body?.text).toContain(`Hello World!`)

    e2e.clearCalls()

    const res3 = await e2e.sendText(`gibberish`)
    expect(res3[0]?.body?.text).toBe(e2e.gmsg(`general-status`, `d`, {isNotFound: true}))
  })

  it(`support custom user and chat options`, async () => {
    const responses = await e2e.sendText(`/start`, {
      user: {id: 99999, first_name: `CustomUser`, username: `customuser`},
      chat: {id: 88888, type: `private`, first_name: `CustomChat`}
    })

    expect(responses[0]?.body?.text).toContain(`Hello World!`)
  })
})
