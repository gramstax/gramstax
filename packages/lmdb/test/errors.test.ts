/**
 * Unit tests for the typed error hierarchy.
 *
 * Pure logic — no LMDB required. Validates the `instanceof` chain, error
 * names, and contextual messages for every exported error class.
 */
import {describe, expect, it} from "bun:test"
import {
  LmdbDuplicateDbNameError,
  LmdbEmptyPrefixError,
  LmdbEnvClosedError,
  LmdbEnvNotOpenError,
  LmdbError,
  LmdbKeyNotFoundError,
  LmdbMissingDbNameError,
  LmdbReadOnlyError,
  LmdbSchemaAlreadyRegisteredError,
  LmdbSchemaNotRegisteredError,
  LmdbTransactionDoneError,
  LmdbTransactionError
} from "../src/errors"

describe(`error hierarchy`, () => {
  it(`every error extends LmdbError`, () => {
    const all = [
      new LmdbEnvNotOpenError(),
      new LmdbEnvClosedError(),
      new LmdbMissingDbNameError(`X`),
      new LmdbDuplicateDbNameError(`x`),
      new LmdbSchemaNotRegisteredError(`Y`),
      new LmdbSchemaAlreadyRegisteredError(`Y`),
      new LmdbKeyNotFoundError(`db`, `key1`),
      new LmdbTransactionError(`msg`),
      new LmdbTransactionDoneError(),
      new LmdbReadOnlyError(`put`),
      new LmdbEmptyPrefixError()
    ]
    for (const e of all) {
      expect(e).toBeInstanceOf(LmdbError)
      expect(e).toBeInstanceOf(Error)
    }
  })

  it(`every error has the expected name`, () => {
    expect(new LmdbEnvNotOpenError().name).toBe(`LmdbEnvNotOpenError`)
    expect(new LmdbEnvClosedError().name).toBe(`LmdbEnvClosedError`)
    expect(new LmdbMissingDbNameError(`X`).name).toBe(`LmdbMissingDbNameError`)
    expect(new LmdbDuplicateDbNameError(`x`).name).toBe(`LmdbDuplicateDbNameError`)
    expect(new LmdbSchemaNotRegisteredError(`Y`).name).toBe(`LmdbSchemaNotRegisteredError`)
    expect(new LmdbSchemaAlreadyRegisteredError(`Y`).name).toBe(`LmdbSchemaAlreadyRegisteredError`)
    expect(new LmdbKeyNotFoundError(`db`, `k`).name).toBe(`LmdbKeyNotFoundError`)
    expect(new LmdbTransactionError(`msg`).name).toBe(`LmdbTransactionError`)
    expect(new LmdbTransactionDoneError().name).toBe(`LmdbTransactionDoneError`)
    expect(new LmdbReadOnlyError(`put`).name).toBe(`LmdbReadOnlyError`)
    expect(new LmdbEmptyPrefixError().name).toBe(`LmdbEmptyPrefixError`)
  })
})

describe(`error messages`, () => {
  it(`LmdbEnvNotOpenError mentions open() call`, () => {
    expect(new LmdbEnvNotOpenError().message).toMatch(/open/)
  })

  it(`LmdbEnvClosedError explains the env cannot be reused`, () => {
    expect(new LmdbEnvClosedError().message).toMatch(/closed/)
  })

  it(`LmdbMissingDbNameError includes the class name`, () => {
    expect(new LmdbMissingDbNameError(`MyRepo`).message).toContain(`MyRepo`)
  })

  it(`LmdbDuplicateDbNameError includes the colliding dbName`, () => {
    expect(new LmdbDuplicateDbNameError(`users`).message).toContain(`users`)
  })

  it(`LmdbSchemaNotRegisteredError includes the class name`, () => {
    expect(new LmdbSchemaNotRegisteredError(`MyRepo`).message).toContain(`MyRepo`)
  })

  it(`LmdbSchemaAlreadyRegisteredError includes the class name`, () => {
    expect(new LmdbSchemaAlreadyRegisteredError(`MyRepo`).message).toContain(`MyRepo`)
  })

  it(`LmdbKeyNotFoundError includes the key`, () => {
    expect(new LmdbKeyNotFoundError(`users`, `u42`).message).toContain(`u42`)
  })

  it(`LmdbTransactionError includes the original error as cause`, () => {
    const cause = new Error(`boom`)
    const err = new LmdbTransactionError(`wrapper`, cause)
    expect(err.cause).toBe(cause)
  })

  it(`LmdbReadOnlyError includes the operation name`, () => {
    expect(new LmdbReadOnlyError(`put`).message).toContain(`put`)
  })

  it(`LmdbEmptyPrefixError mentions clear() as the alternative`, () => {
    expect(new LmdbEmptyPrefixError().message).toMatch(/clear\(\)/)
  })
})

describe(`error throwability`, () => {
  it(`errors can be thrown and caught as LmdbError`, () => {
    try {
      throw new LmdbEnvNotOpenError()
    } catch (e) {
      expect(e).toBeInstanceOf(LmdbError)
    }
  })
})
