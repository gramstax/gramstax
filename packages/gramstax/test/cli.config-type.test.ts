import {mkdtempSync, rmSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {describe, expect, it} from "bun:test"
import type {GramstaxConfig} from "../src/index"
import {GramstaxConfigLoader} from "~/cli/config"

describe(`GramstaxConfig barrel type`, () => {
  it(`resolves from the barrel and accepts every ITGramstaxConfig key`, () => {
    const config: GramstaxConfig = {
      token: `test`,
      deploy: `polling`,
      optionsDeploy: {serverless: {adapter: `cloudflare-mod`, name: `w`, url: `https://w.example.workers.dev/webhook`, secretToken: `test-secret`}},
      cacheSession: {store: `memory`, ttlMs: 4 * 60 * 60 * 1000, namespace: `s`},
      log: {override: {module: `./src/helpers/log.ts`, export: `LogHe`}},
      optionsPage: {shortCallbackQueryData: true},
      mediaRoots: undefined,
      botConfig: undefined,
      autoRetry: undefined,
      autoRetryOptions: undefined,
      rateLimit: undefined,
      throttle: undefined,
      updateTimeoutMs: undefined,
      skipDuplicateUpdate: undefined,
      maxTextLength: undefined,
      statusServerPort: undefined,
      statusServerHostname: undefined,
      cacheKeyboard: undefined,
      templateManager: undefined,
      sessionLock: undefined
    }
    expect(config.token).toBe(`test`)
  })

  it(`treats the override-wrapped scaffold shape as validation-clean`, () => {
    const merged = new GramstaxConfigLoader()._validateConfig(`probe`, {
      token: `test`,
      deploy: `polling`,
      optionsDeploy: undefined,
      cacheSession: {store: `memory`},
      log: {override: {module: `./src/helpers/log.ts`, export: `LogHe`}},
      optionsPage: {shortCallbackQueryData: true},
      mediaRoots: undefined,
      botConfig: undefined,
      autoRetry: undefined,
      autoRetryOptions: undefined,
      rateLimit: undefined,
      throttle: undefined,
      updateTimeoutMs: undefined,
      skipDuplicateUpdate: undefined,
      maxTextLength: undefined,
      statusServerPort: undefined,
      statusServerHostname: undefined,
      cacheKeyboard: undefined,
      templateManager: undefined,
      sessionLock: undefined
    })
    expect(merged.token).toBe(`test`)
    expect(merged.mediaRoots).toBeUndefined()
    expect(merged.rateLimit).toBeUndefined()
    expect(merged.sessionLock).toBeUndefined()
  })

  it(`rejects a bare module ref without the override wrapper`, () => {
    const bare: unknown = {
      token: `test`,
      deploy: `polling`,
      optionsDeploy: undefined,
      cacheSession: {store: `memory`},
      log: {module: `./src/helpers/log.ts`, export: `LogHe`},
      optionsPage: {shortCallbackQueryData: true},
      mediaRoots: undefined,
      botConfig: undefined,
      autoRetry: undefined,
      autoRetryOptions: undefined,
      rateLimit: undefined,
      throttle: undefined,
      updateTimeoutMs: undefined,
      skipDuplicateUpdate: undefined,
      maxTextLength: undefined,
      statusServerPort: undefined,
      statusServerHostname: undefined,
      cacheKeyboard: undefined,
      templateManager: undefined,
      sessionLock: undefined
    }
    expect(() => new GramstaxConfigLoader()._validateConfig(`probe`, bare)).toThrow(/override/)
  })

  it(`source-tracks deploy keys`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `gramstax-config-type-`))
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {token: undefined, deploy: \`serverless\`, optionsDeploy: {serverless: {adapter: \`cloudflare-mod\`, name: \`w\`, url: \`https://w.example.workers.dev/webhook\`, secretToken: \`test-secret\`}}}\n`, `utf-8`)
      const keys = await new GramstaxConfigLoader().loadExplicitBuildKeys(dir)
      expect(keys).toEqual({hasFile: true, deploy: true, adapter: true, name: true, url: true})
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })
})
