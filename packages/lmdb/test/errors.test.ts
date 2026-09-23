/**
 * Unit tests for the single `LmdbError` class.
 *
 * Pure logic — no LMDB required. Validates the name, message passthrough,
 * `ErrorOptions` cause, and throwability of the only error this package throws.
 */
import {describe, expect, it} from "bun:test"
import {LmdbError} from "../src/errors"

describe(`LmdbError`, () => {
  it(`is an Error named LmdbError`, () => {
    const err = new LmdbError(`boom`)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe(`LmdbError`)
    expect(err.message).toBe(`boom`)
  })

  it(`carries the ErrorOptions cause`, () => {
    const cause = new Error(`root`)
    const err = new LmdbError(`wrapper`, {cause})
    expect(err.cause).toBe(cause)
  })

  it(`can be thrown and caught as LmdbError`, () => {
    try {
      throw new LmdbError(`x`)
    } catch (e) {
      expect(e).toBeInstanceOf(LmdbError)
    }
  })
})
