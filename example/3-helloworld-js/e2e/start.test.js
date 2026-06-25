import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, msg, kb, buttonLabels} from "./setup.js"

let env

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: StartPage`, () => {
  it(`respond to /start command with Hello World message`, async () => {
    const responses = await env.mockServer.sendText(`/start`)
    const responsesId = await env.mockServer.sendText(`/start`, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]
    const replyId = responsesId[0]
    expect(reply.body?.text).toContain(`Hello World!`)
    expect(reply.body?.text).toContain(`Time now:`)
    expect(replyId.body?.text).toContain(`Halo Dunia!`)
    expect(replyId.body?.text).toContain(`Waktu:`)
    expect(buttonLabels(reply)).toEqual(kb(`start`, `s1`, `inline`, {}))
    expect(buttonLabels(replyId)).toEqual(kb(`start`, `s1`, `inline`, {}, `id`))
  })

  it(`respond to callback query with edited message`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`start`)
    const responsesId = await env.mockServer.sendCallbackQuery(`start`, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0].body?.text).toContain(`Hello World!`)
    expect(responsesId[0].body?.text).toContain(`Halo Dunia!`)
  })

  it(`capture outbound requests`, async () => {
    await env.mockServer.sendText(`/start`)

    const sendMessageReq = env.mockServer.lastRequest(`sendMessage`)
    expect(sendMessageReq).toBeDefined()
    expect(sendMessageReq.body?.text).toContain(`Hello World!`)
  })

  it(`handle multiple sequential interactions`, async () => {
    const res1 = await env.mockServer.sendText(`/start`)
    expect(res1[0]?.body?.text).toContain(`Hello World!`)

    env.clearRequests()

    const res2 = await env.mockServer.sendCallbackQuery(`start`)
    expect(res2[0]?.body?.text).toContain(`Hello World!`)

    env.clearRequests()

    const res3 = await env.mockServer.sendText(`gibberish`)
    expect(res3[0]?.body?.text).toBe(msg(`general-status`, `d`, {isNotFound: true}))
  })

  it(`support custom user and chat options`, async () => {
    const responses = await env.mockServer.sendText(`/start`, {
      user: {id: 99999, first_name: `CustomUser`, username: `customuser`},
      chat: {id: 88888, type: `private`, first_name: `CustomChat`}
    })

    expect(responses[0]?.body?.text).toContain(`Hello World!`)

    const lastUpdate = env.mockServer.updates[env.mockServer.updates.length - 1]
    const msg = lastUpdate?.message
    expect(msg?.from?.id).toBe(99999)
    expect(msg?.chat?.id).toBe(88888)
  })
})
