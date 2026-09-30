import {describe, expect, it} from "bun:test"
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {GramstaxStart} from "~/cli/start"

describe(`temp-fixture gramstax start boot`, () => {
  it(`boots deploy test with no string grammar`, async () => {
    const dir = mkdtempSync(join(import.meta.dir, `tmp-proof-`))
    try {
      mkdirSync(join(dir, `src`, `core`), {recursive: true})
      mkdirSync(join(dir, `src`, `pages`), {recursive: true})
      writeFileSync(join(dir, `src`, `core`, `bot.ts`), [`import {Gramstax} from "~/core/bot"`, ``, `export class BotCore extends Gramstax {`, `}`, ``].join(`\n`), `utf-8`)
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {token: \`test\`, deploy: \`test\`}\n`, `utf-8`)
      const bot = await new GramstaxStart().boot([], dir)
      expect(bot.deployType).toBe(`test`)
      await bot.stop()
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })
})
