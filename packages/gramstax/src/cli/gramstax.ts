#!/usr/bin/env node
import {existsSync, readFileSync} from "node:fs"
import {dirname, join} from "node:path"
import {fileURLToPath} from "node:url"
import {Command, CommanderError} from "commander"
import {GramstaxBuild} from "./build"
import {GramstaxStart} from "./start"

export class GramstaxProgram {
  create(): Command {
    const program = new Command()
    program.name(`gramstax`).description(`Gramstax Telegram bot toolkit`).version(this._loadVersion()).exitOverride()
    program
      .command(`build`)
      .description(`Freeze pages into .gramstax/ build artifacts (Phase 1: parse, validate and print plan only)`)
      .option(`--dry-run`, `Print resolved plan without writing`, false)
      .option(`--raw`, `Skip build for raw deploy projects (no pages)`, false)
      .option(`--target <name>`, `Serverless target to emit (supported: lambda, cloudflare-workers)`)
      .option(`--bundle`, `Bundle cloudflare-workers server entry into single-file bundle.js`, false)
      .action(async (options: {dryRun?: boolean; raw?: boolean; target?: string; bundle?: boolean}) => {
        const argv: string[] = []
        if (options.dryRun === true) argv.push(`--dry-run`)
        if (options.raw === true) argv.push(`--raw`)
        if (options.target !== undefined) argv.push(`--target`, options.target)
        if (options.bundle === true) argv.push(`--bundle`)
        process.exitCode = await new GramstaxBuild().run(argv)
      })
    program
      .command(`start`)
      .description(`Boot polling/webhook bot from gramstax.config.ts (no index.ts)`)
      .option(`--deploy <mode>`, `Deploy mode (beats config)`)
      .option(`--watch`, `Restart on src change`, false)
      .action(async (options: {deploy?: string; watch?: boolean}) => {
        const argv: string[] = []
        if (options.deploy !== undefined) argv.push(`--deploy`, options.deploy)
        if (options.watch === true) argv.push(`--watch`)
        process.exitCode = await new GramstaxStart().run(argv)
      })
    return program
  }

  markMainSuccess(): void {
    if (process.exitCode === undefined) process.exitCode = 0
  }

  handleMainError(error: unknown): void {
    if (error instanceof CommanderError && (error.code === `commander.helpDisplayed` || error.code === `commander.version`)) {
      process.exitCode = 0
      return
    }
    // Commander already displays its own errors (unknown option, missing
    // argument, ...) before throwing — re-printing here doubled every line.
    if (error instanceof CommanderError === false) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(message)
    }
    process.exitCode = 2
  }

  _findPackageJson(startDir: string): string {
    let dir = startDir
    for (let index = 0; index < 10; index++) {
      const candidate = join(dir, `package.json`)
      if (existsSync(candidate)) return candidate
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    throw new Error(`package.json not found`)
  }

  _loadVersion(): string {
    try {
      const raw = readFileSync(this._findPackageJson(dirname(fileURLToPath(import.meta.url))), `utf-8`)
      const parsed = JSON.parse(raw) as {version?: unknown}
      if (typeof parsed.version === `string` && parsed.version.length > 0) return parsed.version
      return `0.0.0`
    } catch {
      return `0.0.0`
    }
  }
}

class Helper {
  static isMainModule(): boolean {
    const argv1 = process.argv[1] ?? ``
    if (argv1 === ``) return false
    try {
      const current = fileURLToPath(import.meta.url)
      if (argv1 === current) return true
      if (argv1.endsWith(`gramstax`) || argv1.endsWith(`gramstax.js`)) return true
      return false
    } catch {
      return false
    }
  }
}

export const program = new GramstaxProgram().create()
if (Helper.isMainModule()) {
  const main = new GramstaxProgram()
  program.parseAsync(process.argv).then(main.markMainSuccess).catch(main.handleMainError)
}
