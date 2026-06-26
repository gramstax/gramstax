import {describe, it, expect, beforeAll} from "bun:test"
import {getEnv, type TestEnvironment} from "./setup"

let env: TestEnvironment

beforeAll(async () => {
  env = await getEnv()
})

describe(`E2E: BlankPage`, () => {
  it(`load as a registered page in the bot`, () => {
    const allPages = env.botCore.pages.all
    expect(allPages[`blank`]).toBeDefined()
    expect(allPages[`start`]).toBeDefined()
    expect(allPages[`balance`]).toBeDefined()
    expect(allPages[`deposit`]).toBeDefined()
    expect(allPages[`withdraw`]).toBeDefined()
    expect(allPages[`transfer`]).toBeDefined()
    expect(allPages[`history`]).toBeDefined()
    expect(allPages[`general-status`]).toBeDefined()
  })
})
