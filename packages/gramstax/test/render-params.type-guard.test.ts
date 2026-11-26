import {spawnSync} from "node:child_process"
import {mkdirSync, rmSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {afterAll, describe, expect, it} from "bun:test"

/**
 * Guards the route-completeness contract of the `render*()` params.
 *
 * `renderText` / `renderMedia` / `renderMediaGroup` take disjoint unions over
 * their runtime routes, and a field a route never reads is declared `?: never`.
 * That prohibition is only worth something if a regression breaks the build, so
 * this suite generates a fixture, compiles it, and asserts:
 *
 *   - every `// BAN:` block produces at least one diagnostic, and
 *   - no diagnostic lands outside a `// BAN:` block.
 *
 * The unmarked calls are deliberate POSITIVE controls: an over-tightened type
 * fails here too, so the guard cannot be satisfied by rejecting everything.
 *
 * Why a generated fixture instead of `@ts-expect-error`: the repo bans that
 * directive, and it would also hide the assertion from any compiler that skipped
 * the file. Here the compiler is the thing under test.
 *
 * Note for future readers: if `~/*` fails to resolve, `Ctx` degrades to `any` and
 * every banned case silently passes. That is why the generated tsconfig carries
 * an explicit `paths` map and why the positive controls below exist.
 */

const DIR = join(import.meta.dir, `.type-guard`)
const FIXTURE = join(DIR, `cases.ts`)
const TSCONFIG = join(DIR, `tsconfig.json`)

/**
 * The repo-local `tsc` (the pinned typescript devDependency). A bare `tsc`
 * only resolves when the runner image happens to ship one on PATH — when
 * ubuntu-latest moved from 24.04 (had it) to 26.04 (does not), both suites
 * failed with zero diagnostics instead of a clear error. Resolve it from the
 * workspace root so the compiler under test is always the pinned one.
 */
const TSC = join(import.meta.dir, `..`, `..`, `..`, `node_modules`, `.bin`, process.platform === `win32` ? `tsc.cmd` : `tsc`)

/**
 * Runs the local compiler on a generated project. A non-zero exit is normal
 * here (the fixture is deliberately invalid), so only a spawn failure or a
 * signal kill throws — but it throws loudly, so a missing compiler can never
 * again degrade to zero diagnostics and a vacuous pass.
 */
function runTsc(project: string): string {
  const run = spawnSync(TSC, [`-p`, project], {encoding: `utf8`})
  if (run.error) throw new Error(`local tsc failed to start (${TSC}): ${run.error.message}`)
  if (run.status === null) throw new Error(`local tsc was killed by signal ${run.signal ?? `unknown`} (${TSC})`)
  return `${run.stdout ?? ``}${run.stderr ?? ``}`
}

const LEGAL = [
  `ctx.renderText({})`,
  `ctx.renderText({keyboard: null, data: null, AGBaseId: null})`,
  `ctx.renderText({mode: \`auto\`})`,
  `ctx.renderText({mode: \`edit\`, fallback: \`disable\`, editOptions: {}, fallbackOptions: {}})`,
  `ctx.renderText({mode: \`reply\`, options: {reply_markup: {remove_keyboard: true}}, richOptions: {}})`,
  `ctx.renderText({chunkSize: 100})`,
  `ctx.renderText({chunkSize: 100, mode: \`reply\`})`,
  `ctx.renderText({chunkSize: null})`,
  `ctx.renderText({broadcast: {ids: [1], languageCode: [\`en\`]}, options: {parse_mode: \`HTML\`}, richOptions: {}})`,
  `ctx.renderMedia({type: \`photo\`})`,
  `ctx.renderMedia({type: \`photo\`, mode: \`edit\`, resendOptions: {}, mediaOptions: {}, fallback: \`reply\`, fallbackOptions: {}})`,
  `ctx.renderMedia({type: \`photo\`, mode: \`reply\`, captionOptions: {}})`,
  `ctx.renderMedia({broadcast: {ids: [1], languageCode: [\`en\`]}, captionOptions: {}})`,
  `ctx.renderMedia({type: \`photo\`, broadcast: {targets: [{chatId: 1, messageId: 2}]}, mediaOptions: {}, fallback: \`reply\`})`,
  `ctx.renderMediaGroup({})`,
  `ctx.renderMediaGroup({mode: \`reply\`, options: {}})`,
  `ctx.renderPhotoGroup({mode: \`edit\`})`,
  `ctx.renderPhoto({mode: \`reply\`, captionOptions: {}})`,
  `ctx.renderPhoto({mode: \`edit\`, mediaOptions: {}, fallback: \`reply\`})`,
  `ctx.renderDice({})`,
  `ctx.renderVenue({mode: \`reply\`})`,
  `ctx.renderGift({target: 1, giftId: \`g\`})`,
  // The keyboard field is per-route: a bottom keyboard is legal wherever a send
  // can happen — including a media edit, whose delete-and-resend path is a send —
  // and inline-only where the call is always `editMessageText`.
  `ctx.renderText({keyboard: ctx.bottomKeyboard((k) => k)})`,
  `ctx.renderText({mode: \`auto\`, keyboard: ctx.bottomKeyboard((k) => k)})`,
  `ctx.renderText({mode: \`edit\`, keyboard: ctx.inlineKeyboard((k) => k)})`,
  `ctx.renderMedia({type: \`photo\`, mode: \`edit\`, keyboard: ctx.bottomKeyboard((k) => k)})`,
  `ctx.renderEditCaption({keyboard: ctx.inlineKeyboard((k) => k)})`,
  `ctx.renderEditKeyboard({keyboard: null})`,
  `ctx.renderWidget({})`,
  `ctx.renderWidget({mode: \`reply\`, keyboard: ctx.inlineKeyboard((k) => k)})`,
  `ctx.renderWidget({mode: \`reply\`, keyboard: ctx.bottomKeyboard((k) => k)})`,
  `ctx.renderWidget({mode: \`reply\`, is_shared: true})`,
  `ctx.renderWidget({is_shared: false})`,
  `ctx.renderWidget({mode: \`reply\`, is_shared: null})`,
  `ctx.renderWidget({broadcast: {ids: [1], languageCode: [\`en\`]}, is_shared: true})`,
  `ctx.renderWidget({mode: \`edit\`, keyboard: ctx.inlineKeyboard((k) => k)})`,
  `ctx.renderWidget({mode: \`update-data\`})`,
  `ctx.renderWidget({broadcast: {ids: [1], languageCode: [\`en\`]}})`,
  `ctx.renderWidget({broadcast: {targets: [{chatId: 1, messageId: 2}]}})`
]

const BANNED: Array<[string, string]> = [
  [`renderText: broadcast short-circuits mode`, `ctx.renderText({mode: \`edit\`, broadcast: {ids: [1], languageCode: [\`en\`]}})`],
  [`renderText: chunkSize short-circuits mode`, `ctx.renderText({chunkSize: 10, mode: \`edit\`})`],
  [`renderText: chunkSize short-circuits broadcast`, `ctx.renderText({chunkSize: 10, broadcast: {ids: [1], languageCode: [\`en\`]}})`],
  [`renderText: forced reply cannot fall back`, `ctx.renderText({mode: \`reply\`, fallback: \`reply\`})`],
  [`renderText: an always-edit route has no send options`, `ctx.renderText({mode: \`edit\`, options: {}})`],
  [`renderText: a forced reply has no fallback options`, `ctx.renderText({mode: \`reply\`, fallbackOptions: {}})`],
  [`renderMedia: broadcast send ignores type`, `ctx.renderMedia({type: \`photo\`, broadcast: {ids: [1], languageCode: [\`en\`]}})`],
  [`renderMedia: broadcast revise ignores mode`, `ctx.renderMedia({type: \`photo\`, mode: \`edit\`, broadcast: {targets: [{chatId: 1, messageId: 2}]}})`],
  [`renderMedia: forced reply cannot take the edit slots`, `ctx.renderMedia({type: \`photo\`, mode: \`reply\`, resendOptions: {}, mediaOptions: {}})`],
  [`renderMedia: broadcast send cannot take the edit slots`, `ctx.renderMedia({broadcast: {ids: [1], languageCode: [\`en\`]}, resendOptions: {}})`],
  [`renderMedia: has no sendMessage options bag at all`, `ctx.renderMedia({type: \`photo\`, options: {}})`],
  [`renderMediaGroup: forced reply cannot fall back`, `ctx.renderMediaGroup({mode: \`reply\`, fallback: \`reply\`})`],
  [`renderMediaGroup: sendMediaGroup carries no keyboard`, `ctx.renderPhotoGroup({keyboard: ctx.inlineKeyboard((k) => k)})`],
  [`renderGift: sendGift carries no keyboard`, `ctx.renderGift({target: 1, giftId: \`g\`, keyboard: null})`],
  [`renderDice: reply-only, mode cannot be edit`, `ctx.renderDice({mode: \`edit\`})`],
  [`renderText: an always-edit route rejects a bottom keyboard`, `ctx.renderText({mode: \`edit\`, keyboard: ctx.bottomKeyboard((k) => k)})`],
  [`renderEditCaption: an edit rejects a bottom keyboard`, `ctx.renderEditCaption({keyboard: ctx.bottomKeyboard((k) => k)})`],
  [`renderEditKeyboard: an edit rejects a bottom keyboard`, `ctx.renderEditKeyboard({keyboard: ctx.bottomKeyboard((k) => k)})`],
  [`renderWidget: broadcast send short-circuits mode`, `ctx.renderWidget({mode: \`edit\`, broadcast: {ids: [1], languageCode: [\`en\`]}})`],
  [`renderWidget: broadcast revise ignores mode`, `ctx.renderWidget({mode: \`edit\`, broadcast: {targets: [{chatId: 1, messageId: 2}]}})`],
  [`renderWidget: there is no auto mode`, `ctx.renderWidget({mode: \`auto\`})`],
  [`renderWidget: an edit has no send options`, `ctx.renderWidget({mode: \`edit\`, options: {}})`],
  [`renderWidget: update-data carries no keyboard`, `ctx.renderWidget({mode: \`update-data\`, keyboard: ctx.inlineKeyboard((k) => k)})`],
  [`renderWidget: update-data carries no options`, `ctx.renderWidget({mode: \`update-data\`, options: {}})`],
  [`renderWidget: broadcast revise carries no options`, `ctx.renderWidget({broadcast: {targets: [{chatId: 1, messageId: 2}]}, options: {}})`],
  [`renderWidget: a forced reply has no chunkSize`, `ctx.renderWidget({mode: \`reply\`, chunkSize: 5})`],
  [`renderWidget: an edit rejects a bottom keyboard`, `ctx.renderWidget({mode: \`edit\`, keyboard: ctx.bottomKeyboard((k) => k)})`],
  [`renderWidget: an edit takes no is_shared`, `ctx.renderWidget({mode: \`edit\`, is_shared: true})`],
  [`renderWidget: update-data takes no is_shared`, `ctx.renderWidget({mode: \`update-data\`, is_shared: true})`],
  [`renderWidget: broadcast revise takes no is_shared`, `ctx.renderWidget({broadcast: {targets: [{chatId: 1, messageId: 2}]}, is_shared: true})`]
]

const MARKER = `// BAN: `
const rows = [
  `import type {Ctx} from "../../src/core/ctx"`,
  ``,
  `declare const ctx: Ctx`,
  ``,
  ...LEGAL,
  ...BANNED.flatMap(([label, call]) => [``, `${MARKER}${label}`, call])
]
const source = rows.join(`\n`)

/** 1-based line -> label, for every line that belongs to a banned block. */
const bannedLines = new Map<number, string>()
let current: string | null = null
rows.forEach((row, i) => {
  if (row.startsWith(MARKER)) current = row.slice(MARKER.length)
  else if (row.trim() === `` || row.startsWith(`//`)) {
    // keep the current block open across blank/comment lines
  } else {
    if (current !== null) bannedLines.set(i + 1, current)
    current = null
  }
})

function compile() {
  mkdirSync(DIR, {recursive: true})
  writeFileSync(FIXTURE, source, `utf8`)
  writeFileSync(
    TSCONFIG,
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
        files: [`./cases.ts`]
      },
      null,
      2
    ),
    `utf8`
  )
  const out = runTsc(TSCONFIG)
  const lines = out.split(/\r?\n/).filter((l) => l.includes(`cases.ts(`) && /error TS\d+/.test(l))
  const byLine = new Map<number, string[]>()
  for (const l of lines) {
    const m = /cases\.ts\((\d+),\d+\)(: error TS\d+.*)$/.exec(l)
    if (!m) continue
    const line = Number(m[1])
    byLine.set(line, [...(byLine.get(line) ?? []), m[2]!.trim()])
  }
  return {out, byLine}
}

afterAll(() => {
  rmSync(DIR, {recursive: true, force: true})
})

describe(`render params: banned combinations are compile errors`, () => {
  const {byLine} = compile()

  it(`the compiler actually ran and resolved the types`, () => {
    // If the fixture produced zero diagnostics at all, the check below is vacuous
    // and every "rejects:" case would pass for the wrong reason.
    expect(byLine.size).toBeGreaterThan(0)
  })

  it(`no diagnostic falls outside a banned block (positive controls hold)`, () => {
    const stray = [...byLine.keys()].filter((l) => !bannedLines.has(l))
    expect(stray.map((l) => ({line: l, at: rows[l - 1], why: byLine.get(l)}))).toEqual([])
  })

  it(`every banned combination is rejected`, () => {
    const missing: Array<{case: string; line: number}> = []
    for (const [line, label] of bannedLines) {
      const hit = [...byLine.keys()].some((l) => l === line || (l > line && [...bannedLines.keys()].every((b) => b === line || b > l || b < line)))
      if (!hit) missing.push({case: label, line})
    }
    expect(missing).toEqual([])
  })

  it(`reports the offending field, not just any error`, () => {
    const text = [...byLine.values()].flat().join(`\n`)
    expect(text).toContain(`not assignable`)
  })
})
