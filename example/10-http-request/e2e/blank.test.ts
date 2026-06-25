/**
 * E2E Tests: BlankPage
 *
 * BlankPage is an infrastructure page with an empty template.
 * It serves as a base for other pages. This test verifies
 * the page class is properly loaded and has expected structure.
 */
import {describe, it, expect, beforeAll} from "bun:test"
import {getEnv, type TestEnvironment} from "./setup"

let env: TestEnvironment
const intent = `blank`

beforeAll(async () => {
  env = await getEnv()
})

describe(`E2E: BlankPage`, () => {
  it(`load as a registered page in the bot`, () => {
    const allPages = env.botCore.pages.all
    expect(allPages[intent]).toBeDefined()
  })
})
