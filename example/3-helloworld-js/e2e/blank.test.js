import {describe, it, expect, beforeAll} from "bun:test"
import {getEnv} from "./setup.js"

let env

beforeAll(async () => {
  env = await getEnv()
})

describe(`E2E: BlankPage`, () => {
  it(`load as a registered page in the bot`, () => {
    const allPages = env.botCore.pages.all
    expect(allPages[`blank`]).toBeDefined()
  })
})
