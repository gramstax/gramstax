import {spawnSync} from "node:child_process"
import {mkdirSync, rmSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {afterAll, describe, expect, it} from "bun:test"

/**
 * Locks the uniformity of the `render*()` route key set.
 *
 * The point of the two-layer refactor was that route rules live in ONE place.
 * That only stays true while every route-using params type declares the same
 * route keys — with a real type where the route reads them, `never` where it does
 * not. A key that quietly disappears from one atom is invisible at every call
 * site: the union still compiles, the field still works everywhere else, and the
 * hole only opens for the methods that used it. So it is asserted here instead.
 *
 * The mechanism is the compiler, for the same reason as `render-params.type-guard`:
 * the repo bans `@ts-expect-error`, and a test that only counted strings could not
 * tell a genuinely complete key set from one that merely looked complete.
 *
 * `keyof` on a union is the INTERSECTION of its members' keys, which is exactly the
 * property needed — a key declared by only some members drops out of the
 * intersection and fails the assertion below.
 *
 * The second `it` is a MUTATION control: it adds a sentinel key that no type can
 * have and requires the compiler to object. Without it, an assertion that is
 * vacuously true for every input would pass this suite forever and protect
 * nothing — which is the failure mode the type-guard suite guards against.
 *
 * One limitation, stated rather than papered over: declaration ORDER is not
 * observable to the compiler (types are erased), so this suite locks the key SET.
 * Order shows up in the generated API reference, which is regenerated separately.
 */

const UNIVERSAL = [`mode`, `keyboard`, `rich`, `richOptions`, `broadcast`, `chunkSize`, `fallback`, `options`, `editOptions`, `fallbackOptions`] as const

/** Every params type that takes a delivery route. The six query answers and `renderBroadcastDelete` are excluded on purpose: they send no message, so they have no route. */
const ROUTE_PARAMS = [
  `IRenderTextParams`,
  `IRenderMediaParams<\`photo\`>`,
  `IRenderMediaKindParams<\`photo\`>`,
  `IRenderMediaGroupParams`,
  `IRenderMediaGroupKindParams`,
  `IRenderPollParams`,
  `IRenderInvoiceParams`,
  `IRenderPaidMediaParams`,
  `IRenderVenueParams`,
  `IRenderDiceParams`,
  `IRenderGiftParams`,
  `IRenderEditCaptionParams`,
  `IRenderEditKeyboardParams`
] as const

const DIR = join(import.meta.dir, `.symmetry`)

/** Builds a fixture that requires every route-using type to declare `universal`. */
function fixture(universal: readonly string[]) {
  return [
    `import type {${ROUTE_PARAMS.map((name) => name.split(`<`)[0]).join(`, `)}} from "../../src/types/ctx"`,
    ``,
    `type Universal = ${JSON.stringify(universal)}[number]`,
    `type Missing<T> = Exclude<Universal, keyof T>`,
    `type Assert<T extends true> = T`,
    `type HasAll<T> = [Missing<T>] extends [never] ? true : false`,
    ``,
    ...ROUTE_PARAMS.map((name, i) => `export type Check${i} = Assert<HasAll<${name}>>`),
    ``
  ].join(`\n`)
}

function compile(name: string, universal: readonly string[]) {
  mkdirSync(DIR, {recursive: true})
  writeFileSync(join(DIR, `${name}.ts`), fixture(universal), `utf8`)
  writeFileSync(
    join(DIR, `tsconfig.json`),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: `ESNext`,
          module: `Preserve`,
          moduleResolution: `bundler`,
          skipLibCheck: true,
          types: [`node`, `bun`],
          paths: {"~/*": [`../../src/*`]}
        },
        files: [`./${name}.ts`]
      },
      null,
      2
    ),
    `utf8`
  )
  const run = spawnSync(`tsc`, [`-p`, join(DIR, `tsconfig.json`)], {encoding: `utf8`, shell: true})
  const out = `${run.stdout ?? ``}${run.stderr ?? ``}`
  return out
    .split(/\r?\n/)
    .filter((l) => l.includes(`${name}.ts(`) && /error TS\d+/.test(l))
    .map((l) => l.replace(/^.*\.ts\(/, ``).trim())
}

afterAll(() => {
  rmSync(DIR, {recursive: true, force: true})
})

describe(`render params: the route key set is uniform`, () => {
  // Compiled here, not inside `it`: `spawnSync` blocks the event loop, and a
  // `tsc` run takes longer than the per-test timeout.
  const real = compile(`keys`, UNIVERSAL)
  // A key nothing can possibly declare. If this produced no diagnostics,
  // `HasAll` would be vacuously true and the first test would protect nothing.
  const mutated = compile(`mutated`, [...UNIVERSAL, `__no_type_has_this__`])

  it(`every route-using params type declares all ten universal route keys`, () => {
    expect(real).toEqual([])
  })

  it(`the assertion can actually fail (sentinel-key mutation)`, () => {
    // TS2344 is the constraint failure `Assert<false>` raises on each `CheckN`
    // alias — one per route-using type. Counting them is the proof that dropping a
    // key from any single atom would break this suite.
    const flagged = mutated.filter((d) => d.includes(`TS2344`))
    expect(flagged.length).toBe(ROUTE_PARAMS.length)
  })
})