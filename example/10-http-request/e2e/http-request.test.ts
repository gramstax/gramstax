/**
 * E2E Tests: HttpRequestPage
 *
 * Tests for the full HTTP request flow including method selection,
 * URL input, token input, body input, result display, and toggling views.
 */
import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `http-request`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: HttpRequestPage`, () => {
  it(`navigate to New Request page and show method selection`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent)
    const responsesId = await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const edit = responses[0]!
    const editId = responsesId[0]!
    expect(edit.body?.text).toBe(gmsg(intent, `s-method`, {}))
    expect(editId.body?.text).toBe(gmsg(intent, `s-method`, {}, `id`))
    expect(buttonLabels(edit)).toEqual(gkb(intent, `s-method`, `inline`, {}))
    expect(buttonLabels(editId)).toEqual(gkb(intent, `s-method`, `inline`, {}, `id`))
  })

  it(`show URL input form when a method is selected`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    const navResponses = await env.mockServer.sendCallbackQuery(intent)

    // Verify method buttons have correct callback data before clicking
    const methodKb = navResponses[0]?.body?.reply_markup?.inline_keyboard
    const getBtn = methodKb!.flat().find((b: any) => b.text === `GET`)
    expect(getBtn).toBeDefined()
    expect(getBtn!.callback_data).toBe(`${intent}:GET`)

    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`${intent}:GET`)
    const responsesId = await env.mockServer.sendCallbackQuery(`${intent}:GET`, {user: {language_code: `id`}})

    expect(responses.length).toBe(1)
    expect(responsesId.length).toBe(1)
    const edit = responses[0]!
    const editId = responsesId[0]!
    expect(edit.body?.text).toBe(gmsg(intent, `s-url`, {method: `GET`}))
    expect(editId.body?.text).toBe(gmsg(intent, `s-url`, {method: `GET`}, `id`))
    expect(buttonLabels(edit)).toEqual(gkb(intent, `s-url`, `inline`, {}))
    expect(buttonLabels(editId)).toEqual(gkb(intent, `s-url`, `inline`, {}, `id`))
  })

  it(`select method again after Back and re-entering method selection`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()

    // Click GET → URL input
    const getResponses = await env.mockServer.sendCallbackQuery(`${intent}:GET`)
    expect(getResponses.length).toBe(1)
    env.clearRequests()

    // Click Back → method selection
    const backResponses = await env.mockServer.sendCallbackQuery(`${intent}:_back`)
    expect(backResponses.length).toBe(1)
    expect(backResponses[0]!.body?.text).toBe(gmsg(intent, `s-method`, {}))
    env.clearRequests()

    // Click POST → URL input (different method)
    const postResponses = await env.mockServer.sendCallbackQuery(`${intent}:POST`)
    expect(postResponses.length).toBe(1)
    const edit = postResponses[0]!
    expect(edit.body?.text).toBe(gmsg(intent, `s-url`, {method: `POST`}))
  })

  it(`select method after completing a full request cycle (start → method → URL → token → result → home → new request → method)`, async () => {
    // First cycle: make a request
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`${intent}:GET`)
    env.clearRequests()
    await env.mockServer.sendText(`${env.httpServerUrl}/test`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`${intent}:skip_token`)
    env.clearRequests()

    // Go home
    await env.mockServer.sendCallbackQuery(`start`)
    env.clearRequests()

    // Second cycle: start new request
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()

    // Select POST method
    const postResponses = await env.mockServer.sendCallbackQuery(`${intent}:POST`)
    expect(postResponses.length).toBe(1)
    const edit = postResponses[0]!
    expect(edit.body?.text).toBe(gmsg(intent, `s-url`, {method: `POST`}))
  })

  it(`show token input form when a URL is sent after selecting method`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`${intent}:GET`)
    env.clearRequests()

    // Send URL — should show token input, not URL input again
    const testUrl = `${env.httpServerUrl}/test`
    const responses = await env.mockServer.sendText(testUrl)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply.body?.text).toBe(gmsg(intent, `s-token`, {method: `GET`, url: testUrl}))
    expect(buttonLabels(reply)).toEqual(gkb(intent, `s-token`, `inline`, {}))
  })

  it(`make HTTP request and show response when user sends a valid URL after method selection`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`${intent}:GET`)
    env.clearRequests()

    const testUrl = `${env.httpServerUrl}/test`
    await env.mockServer.sendText(testUrl)
    env.clearRequests()

    // Skip token step → triggers GET request
    const responses = await env.mockServer.sendCallbackQuery(`${intent}:skip_token`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply).toBeDefined()
    expect(reply.body?.text).toContain(`[GET]`)
    expect(reply.body?.text).toContain(`200`)
    expect(reply.body?.text).toContain(`OK`)
    expect(reply.body?.text).toContain(`Hello from test server`)
    expect(buttonLabels(reply)).toEqual(gkb(intent, `s-success`, `inline`, {toggleLabel: `🔁 Raw`}))
  })

  it(`escape HTML in response body`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`${intent}:GET`)
    env.clearRequests()

    const testUrl = `${env.httpServerUrl}/html`
    await env.mockServer.sendText(testUrl)
    env.clearRequests()

    // Skip token → triggers request
    const responses = await env.mockServer.sendCallbackQuery(`${intent}:skip_token`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply).toBeDefined()
    expect(reply.body?.text).toContain(`&lt;h1&gt;`)
    expect(reply.body?.text).toContain(`Hello HTML`)
    expect(reply.body?.text).not.toContain(`<h1>`)
  })

  it(`show invalid URL warning for non-http input`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`${intent}:GET`)
    env.clearRequests()

    const responses = await env.mockServer.sendText(`not-a-valid-url`)
    const responsesId = await env.mockServer.sendText(`not-a-valid-url`, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply).toBeDefined()
    expect(replyId).toBeDefined()
    expect(reply.body?.text).toBe(gmsg(intent, `w-invalid`, {url: `not-a-valid-url`}))
    expect(replyId.body?.text).toBe(gmsg(intent, `w-invalid`, {url: `not-a-valid-url`}, `id`))
    expect(buttonLabels(reply)).toEqual(gkb(intent, `w-invalid`, `inline`, {}))
    expect(buttonLabels(replyId)).toEqual(gkb(intent, `w-invalid`, `inline`, {}, `id`))
  })

  it(`show 404 response for not-found endpoint`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`${intent}:GET`)
    env.clearRequests()

    const testUrl = `${env.httpServerUrl}/not-found`
    await env.mockServer.sendText(testUrl)
    env.clearRequests()

    // Skip token → triggers request
    const responses = await env.mockServer.sendCallbackQuery(`${intent}:skip_token`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply).toBeDefined()
    expect(reply.body?.text).toContain(`404`)
    expect(reply.body?.text).toContain(`Not Found`)
    expect(buttonLabels(reply)).toEqual(gkb(intent, `s-success`, `inline`, {toggleLabel: `🔁 Raw`}))
  })

  it(`go back to method selection when clicking Back from URL input`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`${intent}:GET`)
    env.clearRequests()

    // Click Back — should return to method selection
    const responses = await env.mockServer.sendCallbackQuery(`${intent}:_back`)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toBe(gmsg(intent, `s-method`, {}))
    expect(buttonLabels(edit)).toEqual(gkb(intent, `s-method`, `inline`, {}))
  })

  it(`complete POST request with body and echo the body`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()

    // Select POST method
    await env.mockServer.sendCallbackQuery(`${intent}:POST`)
    env.clearRequests()

    // Send URL — triggers token step
    const echoUrl = `${env.httpServerUrl}/echo`
    await env.mockServer.sendText(echoUrl)
    env.clearRequests()

    // Skip token → body input form
    await env.mockServer.sendCallbackQuery(`${intent}:skip_token`)
    env.clearRequests()

    // Send body — triggers actual POST request
    const responses = await env.mockServer.sendText(`{"hello": "world"}`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply).toBeDefined()
    expect(reply.body?.text).toContain(`[POST]`)
    expect(reply.body?.text).toContain(`200`)
    expect(reply.body?.text).toContain(`echoed`)
    expect(buttonLabels(reply)).toEqual(gkb(intent, `s-success`, `inline`, {toggleLabel: `🔁 Raw`}))
  })

  it(`pretty-print JSON response bodies with indentation`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`${intent}:GET`)
    env.clearRequests()

    const testUrl = `${env.httpServerUrl}/test`
    await env.mockServer.sendText(testUrl)
    env.clearRequests()

    // Skip token → triggers request
    const responses = await env.mockServer.sendCallbackQuery(`${intent}:skip_token`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply).toBeDefined()
    expect(reply.body?.text).toContain(`\n`)
    expect(reply.body?.text).toContain(`Hello from test server`)
    expect(reply.body?.text).toContain(`ok`)
    expect(buttonLabels(reply)).toEqual(gkb(intent, `s-success`, `inline`, {toggleLabel: `🔁 Raw`}))
  })

  it(`toggle between formatted and raw JSON body views`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`${intent}:GET`)
    env.clearRequests()

    // Send URL — triggers token step
    const testUrl = `${env.httpServerUrl}/test`
    await env.mockServer.sendText(testUrl)
    env.clearRequests()

    // Click Skip — get formatted success response
    const successResponses = await env.mockServer.sendCallbackQuery(`${intent}:skip_token`)
    expect(successResponses.length).toBeGreaterThan(0)
    const successReply = successResponses[0]
    expect(successReply?.body?.text).toContain(`\n  "message"`)
    expect(buttonLabels(successReply)).toEqual(gkb(intent, `s-success`, `inline`, {toggleLabel: `🔁 Raw`}))

    // Click toggle_view — edit to show raw body
    const editResponses = await env.mockServer.sendCallbackQuery(`${intent}:toggle_view`)
    expect(editResponses.length).toBeGreaterThan(0)
    const editReply = editResponses[0]
    expect(editReply?.body?.text).toContain(`{"message"`)
    expect(editReply?.body?.text).not.toContain(`\n  "message"`)
    expect(buttonLabels(editReply)).toEqual(gkb(intent, `s-success`, `inline`, {toggleLabel: `🔁 Formatted`}))

    // Click toggle_view again — back to formatted
    const edit2Responses = await env.mockServer.sendCallbackQuery(`${intent}:toggle_view`)
    expect(edit2Responses.length).toBeGreaterThan(0)
    const edit2Reply = edit2Responses[0]
    expect(edit2Reply?.body?.text).toContain(`\n  "message"`)
    expect(buttonLabels(edit2Reply)).toEqual(gkb(intent, `s-success`, `inline`, {toggleLabel: `🔁 Raw`}))
  })

  it(`send Bearer token in Authorization header when provided`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`${intent}:GET`)
    env.clearRequests()

    // Send URL — triggers token step
    const headersUrl = `${env.httpServerUrl}/echo-headers`
    await env.mockServer.sendText(headersUrl)
    env.clearRequests()

    // Send Bearer token — triggers request with Authorization header
    const responses = await env.mockServer.sendText(`my-secret-token`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply.body?.text).toContain(`[GET]`)
    expect(reply.body?.text).toContain(`200`)
    expect(reply.body?.text).toContain(`Bearer my-secret-token`)
    expect(buttonLabels(reply)).toEqual(gkb(intent, `s-success`, `inline`, {toggleLabel: `🔁 Raw`}))
  })

  it(`skip token input when Skip is clicked and make request without Authorization`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`${intent}:GET`)
    env.clearRequests()

    // Send URL — triggers token step
    const testUrl = `${env.httpServerUrl}/test`
    await env.mockServer.sendText(testUrl)
    env.clearRequests()

    // Click Skip — makes request without token
    const responses = await env.mockServer.sendCallbackQuery(`${intent}:skip_token`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply.body?.text).toContain(`[GET]`)
    expect(reply.body?.text).toContain(`200`)
    expect(reply.body?.text).toContain(`Hello from test server`)
    expect(buttonLabels(reply)).toEqual(gkb(intent, `s-success`, `inline`, {toggleLabel: `🔁 Raw`}))
  })
})
