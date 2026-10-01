import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {describe, expect, it} from "bun:test"
import {CommanderError} from "commander"
import type {Command} from "commander"
import {GramstaxConfigLoader} from "~/cli/config"
import {GramstaxProgram} from "~/cli/gramstax"

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), `gramstax-cli-coverage-`))
}

function writeConfig(dir: string, body: string): void {
  writeFileSync(join(dir, `gramstax.config.ts`), body, `utf-8`)
}

async function loadExpectThrow(dir: string): Promise<string> {
  try {
    await new GramstaxConfigLoader().loadConfig(dir)
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }
  return ``
}

function captureOutput(program: Command): {output: () => string} {
  let text = ``
  const config = {
    writeErr: (chunk: string): void => {
      text += chunk
    },
    writeOut: (chunk: string): void => {
      text += chunk
    }
  }
  program.configureOutput(config)
  for (const subcommand of program.commands) subcommand.configureOutput(config)
  return {output: (): string => text}
}

describe(`gramstax build CLI coverage`, () => {
  it(`loadConfig merges valid file values over defaults`, async () => {
    const dir = makeTempDir()
    try {
      writeConfig(dir, "export default {deploy: `webhook`, optionsDeploy: {webhook: {url: `https://example.com/hook`, secretToken: `test-secret`}}}\n")
      const config = await new GramstaxConfigLoader().loadConfig(dir)
      expect(config).toEqual({deploy: `webhook`, optionsDeploy: {webhook: {url: `https://example.com/hook`, secretToken: `test-secret`}}})
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`loadConfig throws when default export is not an object`, async () => {
    const dir = makeTempDir()
    try {
      writeConfig(dir, "export default 42\n")
      expect(await loadExpectThrow(dir)).toContain(`must be an object`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`loadConfig rejects outDir as unknown field`, async () => {
    const dir = makeTempDir()
    try {
      writeConfig(dir, "export default {outDir: 7}\n")
      expect(await loadExpectThrow(dir)).toContain(`unknown field`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`loadConfig throws when config module cannot load`, async () => {
    const dir = makeTempDir()
    try {
      writeConfig(dir, "export default {oops\n")
      expect(await loadExpectThrow(dir)).toContain(`cannot load module`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`build subcommand runs dry-run plan from cwd convention`, async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, `src`, `pages`), {recursive: true})
    const previousExitCode = process.exitCode
    const previousCwd = process.cwd()
    const logs: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]): void => {
      logs.push(args.map((arg) => String(arg)).join(` `))
    }
    try {
      process.chdir(dir)
      const program = new GramstaxProgram().create()
      await program.parseAsync([`node`, `gramstax`, `build`, `--dry-run`])
      expect(process.exitCode).toBe(0)
      const printed = logs.join(`\n`)
      expect(printed).toContain(`gramstax build plan`)
      expect(printed).toContain(`pagesDir: src/pages`)
      expect(printed).toContain(`outDir: .gramstax`)
      expect(printed).toContain(`targets: `)
      expect(printed).toContain(`deploy: polling (default)`)
      expect(printed).toContain(`dry-run: no files written`)
    } finally {
      console.log = originalLog
      process.exitCode = previousExitCode
      process.chdir(previousCwd)
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`build subcommand maps missing src/pages to exit code 1`, async () => {
    const dir = makeTempDir()
    const previousExitCode = process.exitCode
    const previousCwd = process.cwd()
    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]): void => {
      errors.push(args.map((arg) => String(arg)).join(` `))
    }
    try {
      process.chdir(dir)
      const program = new GramstaxProgram().create()
      await program.parseAsync([`node`, `gramstax`, `build`])
      expect(process.exitCode).toBe(1)
      expect(errors.join(`\n`)).toContain(`pages directory`)
    } finally {
      console.error = originalError
      process.exitCode = previousExitCode
      process.chdir(previousCwd)
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`build subcommand help lists its options`, async () => {
    const program = new GramstaxProgram().create()
    const capture = captureOutput(program)
    let thrown: unknown
    try {
      await program.parseAsync([`node`, `gramstax`, `build`, `--help`])
    } catch (error: unknown) {
      thrown = error
    }
    const commanderError = thrown as {code?: unknown; exitCode?: unknown}
    expect(commanderError.code).toBe(`commander.helpDisplayed`)
    expect(commanderError.exitCode).toBe(0)
    expect(capture.output()).toContain(`--dry-run`)
    expect(capture.output()).not.toContain(`--check`)
    expect(capture.output()).not.toContain(`--pagesDir`)
    expect(capture.output()).not.toContain(`--outDir`)
  })

  it(`--version exits 0`, async () => {
    const program = new GramstaxProgram().create()
    const capture = captureOutput(program)
    let thrown: unknown
    try {
      await program.parseAsync([`node`, `gramstax`, `--version`])
    } catch (error: unknown) {
      thrown = error
    }
    const commanderError = thrown as {code?: unknown; exitCode?: unknown}
    expect(commanderError.code).toBe(`commander.version`)
    expect(commanderError.exitCode).toBe(0)
    expect(capture.output().trim().length).toBeGreaterThan(0)
  })

  it(`unknown command fails with error`, async () => {
    const program = new GramstaxProgram().create()
    captureOutput(program)
    let thrown: unknown
    try {
      await program.parseAsync([`node`, `gramstax`, `frobnicate`])
    } catch (error: unknown) {
      thrown = error
    }
    const commanderError = thrown as {code?: unknown; exitCode?: unknown}
    expect(commanderError.code).toBe(`commander.unknownCommand`)
    expect(commanderError.exitCode).toBe(1)
  })

  it(`markMainSuccess sets exit code 0 when unset and keeps existing code`, () => {
    const previousExitCode = process.exitCode
    try {
      process.exitCode = undefined
      new GramstaxProgram().markMainSuccess()
      const afterUnset: number | undefined = process.exitCode
      expect(afterUnset ?? -1).toBe(0)
      process.exitCode = 1
      new GramstaxProgram().markMainSuccess()
      const afterSet: number | undefined = process.exitCode
      expect(afterSet).toBe(1)
    } finally {
      process.exitCode = previousExitCode
    }
  })

  it(`handleMainError maps help and version to exit 0`, () => {
    const previousExitCode = process.exitCode
    try {
      const main = new GramstaxProgram()
      process.exitCode = undefined
      main.handleMainError(new CommanderError(0, `commander.helpDisplayed`, `(outputHelp)`))
      expect(process.exitCode ?? -1).toBe(0)
      process.exitCode = undefined
      main.handleMainError(new CommanderError(0, `commander.version`, `2.1.0`))
      expect(process.exitCode ?? -1).toBe(0)
    } finally {
      process.exitCode = previousExitCode
    }
  })

  it(`handleMainError maps unknown errors to exit 2 with message`, () => {
    const previousExitCode = process.exitCode
    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]): void => {
      errors.push(args.map((arg) => String(arg)).join(` `))
    }
    try {
      process.exitCode = undefined
      new GramstaxProgram().handleMainError(new Error(`boom`))
      expect(process.exitCode ?? -1).toBe(2)
      expect(errors.join(`\n`)).toContain(`boom`)
    } finally {
      console.error = originalError
      process.exitCode = previousExitCode
    }
  })
})
