/**
 * Composite index tests — concatenated-key sub-DBs over column tuples.
 *
 * Declared with `t.string().index([`a`, `b`])` on the first column by
 * convention; the composite is named `a+b` and queried with full tuples
 * (point), short tuples (prefix), or `{start, end}` bounds (range).
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {type ISchemaIndexesOf, LmdbSchema, t, type ValueOf} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
function assertType<T extends true>(): T {
  return true as T
}

class OrderSchema extends LmdbSchema {
  static db = `comp-order`
  static key = t.number()
  static value = {
    tenant: t.string().index([`tenant`, `status`]),
    status: t.string(),
    team: t.string().index(),
    email: t.string().unique(),
    age: t.number()
  }
}

class MultiSchema extends LmdbSchema {
  static db = `comp-multi`
  static key = t.number()
  static value = {
    a: t.string().index([`a`, `b`]),
    b: t.string(),
    c: t.string().index([`c`, `d`]),
    d: t.string()
  }
}

class BadUnknownSchema extends LmdbSchema {
  static db = `comp-bad-unknown`
  static key = t.number()
  static value = {
    a: t.string().index([`a`, `zz`])
  }
}

class BadAritySchema extends LmdbSchema {
  static db = `comp-bad-arity`
  static key = t.number()
  static value = {
    a: t.string().index([`a`])
  }
}

class BadScalarSchema extends LmdbSchema {
  static db = `comp-bad-scalar`
  static key = t.string()
  static value = t.string().index([`a`, `b`])
}

class BadKeySchema extends LmdbSchema {
  static db = `comp-bad-key`
  static key = t.string().index([`a`, `b`])
  static value = {
    a: t.string(),
    b: t.string()
  }
}

class DupCompositeSchema extends LmdbSchema {
  static db = `comp-dup`
  static key = t.number()
  static value = {
    a: t.string().index([`a`, `b`]),
    b: t.string(),
    x: t.string().index([`a`, `b`])
  }
}

class BadNestedSchema extends LmdbSchema {
  static db = `comp-bad-nested`
  static key = t.number()
  static value = {
    nested: t.object({x: t.string().index([`x`, `y`])})
  }
}

class BadJunkSchema extends LmdbSchema {
  static db = `comp-bad-junk`
  static key = t.number()
  static value = {
    a: t.string().index([`a`, 1 as never])
  }
}

let tmpDir: string
let env: LmdbEnv

beforeEach(() => {
  tmpDir = createTestDir(`lmdb-comp-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 30})
})

afterEach(async () => {
  if (env.state !== `closed`) {
    await env.close()
  }
  await rmWithRetry(tmpDir)
})

async function seedOrders() {
  const orders = env.register(OrderSchema)
  await orders.put(1, {tenant: `t1`, status: `active`, team: `red`, email: `a@x.co`, age: 30})
  await orders.put(2, {tenant: `t1`, status: `archived`, team: `red`, email: `b@x.co`, age: 31})
  await orders.put(3, {tenant: `t1`, status: `active`, team: `blue`, email: `c@x.co`, age: 32})
  await orders.put(4, {tenant: `t2`, status: `active`, team: `red`, email: `d@x.co`, age: 33})
  return orders
}

describe(`composite declaration`, () => {
  it(`maps the composite entry without changing the row type`, () => {
    assertType<Equal<keyof ISchemaIndexesOf<(typeof OrderSchema)[`value`]>, `team` | `email` | `tenant+status`>>()
    assertType<Equal<ValueOf<typeof OrderSchema>, {tenant: string; status: string; team: string; email: string; age: number}>>()
  })

  it(`rejects unknown columns, arity < 2, scalar and key composites`, () => {
    expect(() => env.register(BadUnknownSchema)).toThrow(LmdbError)
    expect(() => env.register(BadAritySchema)).toThrow(LmdbError)
    expect(() => env.register(BadScalarSchema)).toThrow(LmdbError)
    expect(() => env.register(BadKeySchema)).toThrow(LmdbError)
    expect(() => env.register(BadNestedSchema)).toThrow(LmdbError)
    expect(() => env.register(BadJunkSchema)).toThrow(LmdbError)
  })

  it(`rejects duplicate composite names`, () => {
    expect(() => env.register(DupCompositeSchema)).toThrow(LmdbError)
  })

  it(`rejects index sub-DB collisions like single indexes`, () => {
    class Squatter extends LmdbSchema {
      static db = `comp-order:idx:tenant+status`
      static key = t.string()
      static value = {v: t.string()}
    }
    env.register(Squatter)
    expect(() => env.register(OrderSchema)).toThrow(LmdbError)
  })
})

describe(`composite reads`, () => {
  it(`point lookup on the full tuple`, async () => {
    const orders = await seedOrders()
    expect(await orders.findByIndex({"tenant+status": [`t1`, `active`]})).toEqual([
      {tenant: `t1`, status: `active`, team: `red`, email: `a@x.co`, age: 30},
      {tenant: `t1`, status: `active`, team: `blue`, email: `c@x.co`, age: 32}
    ])
    expect(await orders.findByIndex({"tenant+status": [`t1`, `nope`]})).toEqual([])
  })

  it(`prefix seek on a short tuple`, async () => {
    const orders = await seedOrders()
    const rows = await orders.findByIndex({"tenant+status": [`t1`]})
    // Native tuple order: `active` sorts before `archived` (`c` < `r`).
    expect(rows.map((r) => r.email)).toEqual([`a@x.co`, `c@x.co`, `b@x.co`])
    expect(await orders.findByIndex({"tenant+status": [`t9`]})).toEqual([])
  })

  it(`range seek on {start, end} bounds`, async () => {
    const orders = await seedOrders()
    // `end` is exclusive: drops the archived row.
    const bounded = await orders.findByIndex({"tenant+status": {start: [`t1`], end: [`t1`, `archived`]}})
    expect(bounded.map((r) => r.email)).toEqual([`a@x.co`, `c@x.co`])
    // `start` is inclusive: keeps it.
    const fromArchived = await orders.findByIndex({"tenant+status": {start: [`t1`, `archived`], end: [`t2`]}})
    expect(fromArchived.map((r) => r.email)).toEqual([`b@x.co`])
    const openStart = await orders.findByIndex({"tenant+status": {start: [`t2`]}})
    expect(openStart.map((r) => r.email)).toEqual([`d@x.co`])
    const openEnd = await orders.findByIndex({"tenant+status": {end: [`t1`, `archived`]}})
    expect(openEnd.map((r) => r.email)).toEqual([`a@x.co`, `c@x.co`])
  })

  it(`rejects malformed composite queries`, async () => {
    const orders = await seedOrders()
    await expect(orders.findByIndex({"tenant+status": []})).rejects.toBeInstanceOf(LmdbError)
    await expect(orders.findByIndex({"tenant+status": [`t1`, `active`, `extra`]})).rejects.toBeInstanceOf(LmdbError)
    await expect(orders.findByIndex({"tenant+status": `t1` as never})).rejects.toBeInstanceOf(LmdbError)
    await expect(orders.findByIndex({"tenant+status": {}})).rejects.toBeInstanceOf(LmdbError)
    await expect(orders.findByIndex({"tenant+status": {start: []}})).rejects.toBeInstanceOf(LmdbError)
    await expect(orders.findByIndex({"tenant+status": {start: [`t1`, `active`, `extra`]}})).rejects.toBeInstanceOf(LmdbError)
  })

  it(`skips postings whose primary row vanished`, async () => {
    const orders = await seedOrders()
    env.getDb(`comp-order`).removeSync(1)
    expect(await orders.findByIndex({"tenant+status": [`t1`, `active`]})).toEqual([{tenant: `t1`, status: `active`, team: `blue`, email: `c@x.co`, age: 32}])
  })

  it(`combines the composite with other index keys`, async () => {
    const orders = await seedOrders()
    expect(await orders.findByIndex({"tenant+status": [`t1`], team: `red`})).toHaveLength(2)
    expect(await orders.findByIndex({email: `a@x.co`, "tenant+status": [`t1`, `active`]})).toEqual([{tenant: `t1`, status: `active`, team: `red`, email: `a@x.co`, age: 30}])
    expect(await orders.findByIndex({email: `d@x.co`, "tenant+status": [`t1`, `active`]})).toEqual([])
  })

  it(`rejects more than one composite key per query`, async () => {
    const multi = env.register(MultiSchema)
    await multi.put(1, {a: `x`, b: `y`, c: `p`, d: `q`})
    await expect(multi.findByIndex({"a+b": [`x`, `y`], "c+d": [`p`, `q`]})).rejects.toBeInstanceOf(LmdbError)
  })

  it(`honors {limit} on prefix seeks`, async () => {
    const orders = await seedOrders()
    expect(await orders.findByIndex({"tenant+status": [`t1`]}, undefined, {limit: 2})).toHaveLength(2)
  })
})

describe(`composite maintenance`, () => {
  it(`update moves the composite row`, async () => {
    const orders = await seedOrders()
    await orders.put(1, {tenant: `t2`, status: `active`, team: `red`, email: `a@x.co`, age: 30})
    expect(await orders.findByIndex({"tenant+status": [`t1`, `active`]})).toEqual([{tenant: `t1`, status: `active`, team: `blue`, email: `c@x.co`, age: 32}])
    expect(await orders.findByIndex({"tenant+status": [`t2`, `active`]})).toHaveLength(2)
  })

  it(`delete and clear clean composite rows`, async () => {
    const orders = await seedOrders()
    await orders.delete(1)
    expect(await orders.findByIndex({"tenant+status": [`t1`, `active`]})).toHaveLength(1)
    await orders.clear()
    expect(await orders.findByIndex({"tenant+status": [`t1`]})).toEqual([])
  })

  it(`reindex() rebuilds composite tables`, async () => {
    const orders = await seedOrders()
    // Composite tables pin ordered-binary key/value encoding — raw access
    // must pass matching overrides to hit the same cached handle.
    const raw = env.getDb(`comp-order:idx:tenant+status`, {dupSort: true, useVersions: false, encoding: `ordered-binary`, keyEncoding: `ordered-binary`})
    raw.removeSync([`t1`, `active`], 1)
    expect(await orders.findByIndex({"tenant+status": [`t1`, `active`]})).toHaveLength(1)
    const result = await orders.reindex()
    expect(result.built).toBeGreaterThan(0)
    expect(await orders.findByIndex({"tenant+status": [`t1`, `active`]})).toHaveLength(2)
    raw.removeSync([`t1`, `active`], 3)
    await orders.reindex(`tenant+status`)
    expect(await orders.findByIndex({"tenant+status": [`t1`, `active`]})).toHaveLength(2)
  })
})
