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
    expect(allPages[`help`]).toBeDefined()
    expect(allPages[`general-status`]).toBeDefined()
    expect(allPages[`category`]).toBeDefined()
    expect(allPages[`item-list`]).toBeDefined()
    expect(allPages[`item-detail`]).toBeDefined()
    expect(allPages[`inline-with-range`]).toBeDefined()
    expect(allPages[`inline-without-range`]).toBeDefined()
    expect(allPages[`reset`]).toBeDefined()
  })
})
