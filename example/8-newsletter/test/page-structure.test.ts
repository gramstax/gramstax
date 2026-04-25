import {describe, expect, it} from "bun:test"
import {BroadcastPage} from "../src/pages/broadcast"
import {GeneralStatusPage} from "../src/pages/general-status"
import {StartPage} from "../src/pages/start"

describe(`newsletter page structure`, () => {
  it(`exposes static BASE constants for refactored pages`, () => {
    expect(StartPage.BASE).toBeDefined()
    expect(GeneralStatusPage.BASE).toBeDefined()
    expect(BroadcastPage.BASE.prompt).toBe(`prompt`)
    expect(BroadcastPage.BASE.result).toBe(`result`)
  })
})
