/**
 * Unit tests for the codec classes.
 *
 * Pure logic — no LMDB required. Validates default JSON codec, identity
 * codec, factory helper, and the resolution rules for a LmdbRepository subclass.
 */
import {describe, it, expect} from "bun:test"
import {LmdbCodec, LmdbCodecJson, LmdbCodecIdentity, resolveCodec} from "../src/codec"
import {LmdbRepository} from "../src/repository"

describe(`LmdbCodecJson (class)`, () => {
  it(`serializes objects via JSON.stringify`, () => {
    const codec = new LmdbCodecJson()
    expect(codec.serialize({name: `Alice`, age: 30})).toBe(`{"name":"Alice","age":30}`)
  })

  it(`serializes arrays`, () => {
    const codec = new LmdbCodecJson()
    expect(codec.serialize([1, 2, 3])).toBe(`[1,2,3]`)
  })

  it(`serializes primitives`, () => {
    const codec = new LmdbCodecJson()
    expect(codec.serialize(`hello`)).toBe(`"hello"`)
    expect(codec.serialize(42)).toBe(`42`)
    expect(codec.serialize(null)).toBe(`null`)
  })

  it(`deserializes JSON strings back to objects`, () => {
    const codec = new LmdbCodecJson()
    expect(codec.deserialize(`{"name":"Bob"}`)).toEqual({name: `Bob`})
  })

  it(`passes through non-string raw values`, () => {
    const codec = new LmdbCodecJson()
    expect(codec.deserialize({already: `parsed`})).toEqual({already: `parsed`})
    expect(codec.deserialize(42)).toBe(42)
  })

  it(`roundtrips nested structures`, () => {
    const codec = new LmdbCodecJson()
    const original = {user: {tags: [`a`, `b`], meta: {count: 2}}}
    const encoded = codec.serialize(original)
    expect(codec.deserialize(encoded)).toEqual(original)
  })
})

describe(`LmdbCodecIdentity (class)`, () => {
  it(`serializes values unchanged`, () => {
    const codec = new LmdbCodecIdentity()
    expect(codec.serialize(`hello`)).toBe(`hello`)
    expect(codec.serialize(42)).toBe(42)
    expect(codec.serialize({a: 1})).toEqual({a: 1})
  })

  it(`deserializes values unchanged`, () => {
    const codec = new LmdbCodecIdentity()
    expect(codec.deserialize(`hello`)).toBe(`hello`)
    expect(codec.deserialize(42)).toBe(42)
    expect(codec.deserialize({a: 1})).toEqual({a: 1})
  })
})

describe(`LmdbCodec.create (static factory)`, () => {
  it(`wraps custom serialize/deserialize into a LmdbCodec instance`, () => {
    const codec = LmdbCodec.create<Date, number>(
      (d) => d.getTime(),
      (n) => new Date(n)
    )
    const now = new Date(`2026-06-21T10:00:00Z`)
    expect(codec.serialize(now)).toBe(now.getTime())
    expect(codec.deserialize(now.getTime()).toISOString()).toBe(now.toISOString())
  })

  it(`returns an instance of LmdbCodec`, () => {
    const codec = LmdbCodec.create<number, string>(String, Number)
    expect(codec).toBeInstanceOf(LmdbCodec)
  })
})

describe(`resolveCodec`, () => {
  class NoConfig extends LmdbRepository {}

  class WithCodec extends LmdbRepository {
    static codec = new LmdbCodecIdentity()
  }

  class WithStaticSD extends LmdbRepository {
    static serialize(value: any): string {
      return value.toUpperCase()
    }
    static deserialize(raw: any): any {
      return raw.toLowerCase()
    }
  }

  class WithOnlySerialize extends LmdbRepository {
    static serialize(value: any): string {
      return `s:${value}`
    }
  }

  it(`falls back to LmdbCodecIdentity when nothing is defined`, () => {
    const codec = resolveCodec(NoConfig)
    expect(codec).toBeInstanceOf(LmdbCodecIdentity)
  })

  it(`honors explicit LmdbCodecJson override`, () => {
    class WithJson extends LmdbRepository {}
    ;(WithJson as any).dbName = `with-json`
    ;(WithJson as any).codec = new LmdbCodecJson()
    const codec = resolveCodec(WithJson)
    expect(codec).toBeInstanceOf(LmdbCodecJson)
  })

  it(`uses the explicit static codec when provided`, () => {
    const codec = resolveCodec(WithCodec)
    expect(codec).toBeInstanceOf(LmdbCodecIdentity)
    expect(codec).toBe(WithCodec.codec)
  })

  it(`wraps static serialize/deserialize when both defined`, () => {
    const codec = resolveCodec(WithStaticSD)
    expect(codec.serialize(`Hello`)).toBe(`HELLO`)
    expect(codec.deserialize(`WORLD`)).toBe(`world`)
  })

  it(`merges custom serialize with LmdbCodecJson.deserialize when only serialize defined`, () => {
    const codec = resolveCodec(WithOnlySerialize)
    expect(codec.serialize(`x`)).toBe(`s:x`)
    expect(codec.deserialize(`{"a":1}`)).toEqual({a: 1})
  })
})