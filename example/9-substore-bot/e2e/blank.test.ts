import {describe, it, expect, beforeAll} from "bun:test"
import {getEnv, type TestEnvironment} from "./setup"

let env: TestEnvironment

beforeAll(async () => {
  env = await getEnv()
})

describe(`E2E: BlankPage`, () => {
  it(`load as a registered page in the bot`, () => {
    const allPages = env.botCore.pages.all
    expect(allPages[`start`]).toBeDefined()
    expect(allPages[`help`]).toBeDefined()
    expect(allPages[`catalog`]).toBeDefined()
    expect(allPages[`product`]).toBeDefined()
    expect(allPages[`cart`]).toBeDefined()
    expect(allPages[`checkout`]).toBeDefined()
    expect(allPages[`history`]).toBeDefined()
    expect(allPages[`general-status`]).toBeDefined()
  })
})
