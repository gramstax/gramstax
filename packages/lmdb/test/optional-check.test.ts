import {describe, expect, it} from "bun:test"
import {LmdbSchema, t, type ValueOf} from "../src/schema"

class UserSchema extends LmdbSchema {
  static db = `nu-test`
  static key = t.number()
  static value = {
    id: t.number().unique(),
    username: t.string().index(),
    email: t.string(),
    bio: t.string().optional(),
    tags: t.array().optional()
  }
}

type U = ValueOf<typeof UserSchema>

describe(`optional default`, () => {
  it(`non-optional columns are NOT undefined`, () => {
    // id should be number, NOT number | undefined
    const x: U[`id`] = 1
    expect(x).toBe(1)
  })
  it(`optional columns ARE undefined`, () => {
    const x: U[`bio`] = undefined
    expect(x).toBeUndefined()
  })
  it(`optional columns accept strings`, () => {
    const x: U[`bio`] = `hello`
    expect(x).toBe(`hello`)
  })
  it(`array optional columns accept undefined`, () => {
    const x: U[`tags`] = undefined
    expect(x).toBeUndefined()
  })
  it(`scalar schema (t.number()) is not optional`, () => {
    class CounterSchema extends LmdbSchema {
      static db = `cnt`
      static key = t.string()
      static value = t.number()
    }
    type C = ValueOf<typeof CounterSchema>
    const v: C = 42
    expect(v).toBe(42)
  })
})
