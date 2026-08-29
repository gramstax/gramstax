/**
 * Regression tests for the ReDoS vulnerability in LmdbRepository.like().
 *
 * The legacy implementation compiled glob patterns to anchored JS RegExps
 * (^.*.*...$). Patterns within the MAX_WILDCARDS=10 limit — adjacent
 * ('*********Z') or literal-separated ('a*a*a*a*a*Z') — caused exponential
 * backtracking on long keys (measured: a*45 → 27s; LMDB allows ~1978-byte
 * keys). One like() call could block the event loop for minutes.
 *
 * The fix replaces regex compilation with a linear-time iterative glob
 * matcher. These tests pin two properties:
 * 1. TIMING — pathological patterns complete in bounded time regardless of
 *    key length (would take geological time under the old implementation).
 * 2. PARITY — matching semantics are unchanged: '*' = any sequence,
 *    '?' = exactly one char, every other character (including regex
 *    metacharacters) is literal.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbLikePatternError} from "../src/errors"
import {LmdbSchema, t} from "../src/schema"
import type {LmdbEnvSub} from "../src/sub"

import {createTestDir, rmWithRetry} from "./test-helpers"

class PlainSchema extends LmdbSchema { static db = `like-redos-test`; static key = t.string(); static value = t.string() }

let tmpDir: string
let env: LmdbEnv
let plain: LmdbEnvSub<typeof PlainSchema>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-redos-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  plain = env.register(PlainSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbRepository.like ReDoS regression`, () => {
  it(`adjacent-wildcard pattern over long keys completes in bounded time`, async () => {
    // Key sizes sit at the legacy blowup knee (measured: a*40 → >12s on the
    // old regex) so a regression breaches the 2000ms budget within seconds
    // instead of hanging the synchronous main thread forever — which bun's
    // timeout cannot interrupt. Fixed code runs in <5ms at any length.
    await plain.put(`a`.repeat(35), `v1`)
    await plain.put(`a`.repeat(40), `v2`)
    const t0 = performance.now()
    await plain.like(`*********Z`) // 9 wildcards — inside MAX_WILDCARDS=10
    const elapsed = performance.now() - t0
    expect(elapsed).toBeLessThan(2000)
  })

  it(`literal-separated wildcard pattern over long keys completes in bounded time`, async () => {
    await plain.put(`a`.repeat(35), `v1`)
    await plain.put(`a`.repeat(40), `v2`)
    const t0 = performance.now()
    await plain.like(`*a*a*a*a*a*a*a*a*aZ`)
    const elapsed = performance.now() - t0
    expect(elapsed).toBeLessThan(2000)
  })

  it(`wildcard guard still rejects patterns above the limit`, async () => {
    await expect(plain.like(`***********Z`)).rejects.toBeInstanceOf(LmdbLikePatternError) // 11 wildcards
  })
})

describe(`LmdbRepository.like glob semantics parity`, () => {
  interface GlobCase {
    label: string
    pattern: string
    shouldMatch: string[]
    shouldNotMatch: string[]
  }

  // Pins exact legacy behavior: '*' = any sequence (incl. empty),
  // '?' = exactly one char, ALL other characters are literal — including
  // regex metacharacters (. + [ ] etc.), which the legacy implementation
  // escaped before compiling.
  const cases: GlobCase[] = [
    {label: `prefix star`, pattern: `user:*`, shouldMatch: [`user:1`, `user:2`, `user:`], shouldNotMatch: []},
    {label: `infix star`, pattern: `*middle*`, shouldMatch: [`x-middlex`, `middle`, `amiddleb`], shouldNotMatch: [`mid`, `MIDDLE`]},
    {label: `trailing literal after star`, pattern: `*:end`, shouldMatch: [`a:end`, `b:end`], shouldNotMatch: [`end`, `a:endx`]},
    {label: `single-char question mark`, pattern: `u?er:1`, shouldMatch: [`user:1`], shouldNotMatch: [`uer:1`, `usser:1`]},
    {label: `literal dot is not a wildcard`, pattern: `a.c`, shouldMatch: [`a.c`], shouldNotMatch: [`abc`, `axc`]},
    {label: `literal plus is not a quantifier`, pattern: `a+b`, shouldMatch: [`a+b`], shouldNotMatch: [`aab`, `ab`]},
    {label: `brackets are literal`, pattern: `[x]`, shouldMatch: [`[x]`], shouldNotMatch: [`x`]},
    {label: `star matches empty remainder`, pattern: `user:*`, shouldMatch: [`user:`], shouldNotMatch: []},
    {label: `mixed wildcards and literals`, pattern: `u*d*:1*`, shouldMatch: [`userd:x:1y`, `ud:1`], shouldNotMatch: [`d:1`, `uxer:1`]}
  ]

  for (const c of cases) {
    it(`${c.label} (${c.pattern})`, async () => {
      let i = 0
      for (const key of [...c.shouldMatch, ...c.shouldNotMatch]) {
        await plain.put(key, `v${i++}`)
      }
      const hits = (await plain.like(c.pattern)).map(([k]) => k)
      for (const key of c.shouldMatch) {
        expect(hits).toContain(key)
      }
      for (const key of c.shouldNotMatch) {
        expect(hits).not.toContain(key)
      }
    })
  }
})
