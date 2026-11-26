import {describe, expect, it} from "bun:test"
import {nextCountFromTap} from "../src/utils/tap"

describe(`nextCountFromTap`, () => {
  it(`increments the count from a tap request`, () => {
    expect(nextCountFromTap(`tap:0`)).toBe(1)
    expect(nextCountFromTap(`tap:41`)).toBe(42)
  })

  it(`rejects malformed requests`, () => {
    expect(nextCountFromTap(`bogus`)).toBeNull()
    expect(nextCountFromTap(`tap:`)).toBeNull()
    expect(nextCountFromTap(`tap:-1`)).toBeNull()
    expect(nextCountFromTap(`tap:1.5`)).toBeNull()
    expect(nextCountFromTap(``)).toBeNull()
  })
})
