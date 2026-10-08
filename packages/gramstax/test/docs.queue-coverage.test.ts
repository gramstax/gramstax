import {describe, expect, it} from "bun:test"
import {readFileSync} from "node:fs"
import {join} from "node:path"

const ROOT = join(import.meta.dir, `..`, `..`, `..`)

const read = (file: string): string => readFileSync(join(ROOT, file), `utf-8`)

describe(`queue documentation covers both modes`, () => {
  const files = [
    `docs/gramstax-start.md`,
    `docs/gramstax-build.md`,
    `packages/gramstax/skills/gramstax-best-practices/references/deploy-modes.md`,
    `packages/gramstax/skills/gramstax-best-practices/references/deploy-runtime.md`,
    `packages/gramstax/skills/gramstax-best-practices/references/config-boot.md`,
    `packages/gramstax/AGENTS.md`
  ]

  for (const file of files) {
    it(`${file} mentions polling.queue`, () => {
      expect(read(file)).toContain(`polling`)
      expect(read(file)).toMatch(/polling[\s\S]{0,400}queue|queue[\s\S]{0,400}polling/)
    })
  }

  it(`gramstax AGENTS.md reports the real bot.ts line count`, () => {
    const source = read(`packages/gramstax/AGENTS.md`)
    expect(source).not.toContain(`| 1612 `)
  })

  it(`no agent-facing doc points at the deleted src/webhook/queue.ts`, () => {
    for (const file of [`packages/gramstax/AGENTS.md`, `packages/gramstax/docs/architecture.md`, `packages/gramstax/docs/development.md`, `packages/gramstax/docs/glossary.md`]) {
      expect(read(file)).not.toContain(`src/webhook/queue.ts`)
      expect(read(file)).not.toContain(`webhook/queue.ts`)
    }
  })

  it(`gramstax AGENTS.md source layout points at update/queue.ts`, () => {
    expect(read(`packages/gramstax/AGENTS.md`)).toContain(`update/queue.ts`)
  })

  it(`every queue config field is documented in both field tables`, () => {
    const type = read(`packages/gramstax/src/types/bot.ts`)
    const start = type.indexOf(`export type IUpdateQueueConfig`)
    expect(start).toBeGreaterThan(-1)
    const block = type.slice(start, type.indexOf(`\n}`, start))
    const fields = [...block.matchAll(/^ {2}(\w+)\?:/gm)].map((m) => m[1])
    expect(fields.length).toBeGreaterThan(0)
    expect(fields).toContain(`workerCount`)
    expect(fields).toContain(`drainTimeoutMs`)

    const tables = [`docs/gramstax-start.md`, `packages/gramstax/skills/gramstax-best-practices/references/deploy-runtime.md`]
    for (const table of tables) {
      for (const field of fields) {
        expect(read(table)).toContain(`| \`${field}\` |`)
      }
    }
  })
})