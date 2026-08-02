/**
 * Tests for {@link LmdbCodec} — only the custom codec path.
 *
 * @remarks
 * Default encoding (LMDB native msgpack/json/etc.) is exercised in
 * repository.test.ts. The codec itself only matters when a LmdbRepository
 * defines `static codec` for custom transforms (e.g. `Date → number`).
 */
import {describe, expect, it } from "bun:test"
import {LmdbCodec, resolveCodec} from "../src/codec"
import {LmdbRepository} from "../src/repository"
import type {ICodec} from "../src/types"

describe(`LmdbCodec (abstract base)`, () => {
  it(`create() returns a working codec from a serialize/deserialize pair`, () => {
    const codec = LmdbCodec.create<Date, number>(
      (d) => d.getTime(),
      (n) => new Date(n)
    )
    const now = new Date(`2026-06-21T10:00:00Z`)
    expect(codec.serialize(now)).toBe(now.getTime())
    expect(codec.deserialize(now.getTime()).toISOString()).toBe(now.toISOString())
  })

  it(`create() returns an instance of LmdbCodec`, () => {
    const codec = LmdbCodec.create<number, string>((n) => String(n), (s) => Number(s))
    expect(codec).toBeInstanceOf(LmdbCodec)
  })
})

describe(`LmdbCodecConfigurable (internal)`, () => {
  it(`serialize/deserialize round-trip preserves the value`, () => {
    const codec = LmdbCodec.create<{n: number}, string>(
      (v) => `s:${v.n}`,
      (r) => ({n: parseInt(r.slice(2), 10)})
    )
    expect(codec.deserialize(codec.serialize({n: 42}))).toEqual({n: 42})
  })
})

describe(`resolveCodec`, () => {
  class NoConfig extends LmdbRepository {}
  ;(NoConfig as any).dbName = `no-config-codec-test`

  class WithExplicit extends LmdbRepository {}
  ;(WithExplicit as any).dbName = `with-explicit-codec-test`
  const explicit = LmdbCodec.create<number, string>(String, Number)
  ;(WithExplicit as any).codec = explicit

  it(`returns the explicit codec when set`, () => {
    expect(resolveCodec(WithExplicit)).toBe(explicit)
  })

  it(`returns undefined when no codec is defined`, () => {
    expect(resolveCodec(NoConfig)).toBeUndefined()
  })

  it(`wraps static serialize/deserialize when no codec instance is given`, () => {
    class WithStatic extends LmdbRepository {}
    ;(WithStatic as any).dbName = `with-static-codec-test`
    ;(WithStatic as any).serialize = (v: number) => `s:${v}`
    ;(WithStatic as any).deserialize = (r: string) => parseInt(r.slice(2), 10)
    const codec = resolveCodec(WithStatic) as ICodec<number>
    expect(codec).toBeDefined()
    expect(codec!.serialize(5)).toBe(`s:5`)
    expect(codec!.deserialize(`s:42`)).toBe(42)
  })

  it(`wraps partial static methods with passthrough for the missing side`, () => {
    class OnlySerialize extends LmdbRepository {}
    ;(OnlySerialize as any).dbName = `only-serialize-codec-test`
    ;(OnlySerialize as any).serialize = (v: number) => v * 2
    const codec = resolveCodec(OnlySerialize) as ICodec<number>
    expect(codec!.serialize(5)).toBe(10)
    expect(codec!.deserialize(99)).toBe(99)
  })
})