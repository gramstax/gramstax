#!/usr/bin/env node
import {existsSync, readFileSync} from "node:fs"
import {dirname, join} from "node:path"
import {fileURLToPath} from "node:url"
import {Command, CommanderError} from "commander"
import {GramstaxBuild} from "./build"
import {GramstaxStart} from "./start"

export class GramstaxProgram {
  /**
   * Build the Commander program backing the `gramstax` binary.
   *
   * @remarks
   * This layer only parses flags and translates them into the positional `argv`
   * arrays that `GramstaxBuild.run` and `GramstaxStart.run` expect — the actual
   * config loading, discovery and writing happen in those classes. Commander is
   * configured with `exitOverride`, so `--help` and `--version` surface as
   * rejections and are turned into exit code `0` by `handleMainError` rather
   * than calling `process.exit` outright. Each action forwards its flags in a
   * fixed order and copies the resolved exit code onto `process.exitCode`.
   *
   * @returns A `Command` named `gramstax` exposing the `build` and `start` subcommands.
   *
   * @public
   */
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

  /**
   * Treat a resolved `program.parseAsync` as success.
   *
   * @remarks
   * Subcommands assign their own exit code to `process.exitCode`, so a command
   * that already reported a failure keeps it; only an unset code is promoted to
   * `0`. Passed unbound as a `.then` callback, hence the arrow wrapper at the
   * call site rather than a bound `this`.
   *
   * @public
   */
  markMainSuccess(): void {
    if (process.exitCode === undefined) process.exitCode = 0
  }

  /**
   * Translate a rejected `program.parseAsync` into an exit code.
   *
   * @remarks
   * `--help` and `--version` reach here as rejections rather than resolutions
   * because the program is built with `exitOverride`, so they are treated as
   * success. Commander has already printed its own message for parse failures,
   * so only non-Commander errors are echoed here — re-printing doubled every
   * line. The value assigned to `process.exitCode` is the last expression of the
   * handler, which is what the `.catch(main.handleMainError)` chain relies on.
   *
   * @param error - The rejection reason from `program.parseAsync`.
   *
   * @public
   */
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

  /**
   * Walk up from `startDir` looking for the nearest `package.json`.
   *
   * @remarks
   * Bounded to ten directories so a missing file fails fast instead of walking a
   * pathologically deep tree. The walk stops early at a filesystem root, where
   * `dirname` returns the same path.
   *
   * @param startDir - Absolute directory to begin the upward walk from.
   * @returns Absolute path of the first `package.json` found.
   *
   * @throws Error when no `package.json` exists within ten parent directories.
   *
   * @internal
   */
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

  /**
   * Read the CLI version from the nearest `package.json`.
   *
   * @remarks
   * Starts at this module's own directory and walks up, so the version comes from
   * the installed `gramstax` package rather than from whatever project the user
   * happens to run the command in. Every failure — missing file, unparsable JSON,
   * absent or non-string `version` — collapses to `0.0.0` so `--version` always
   * prints something instead of crashing the binary.
   *
   * @returns The `version` field of the nearest `package.json`, or `0.0.0`.
   *
   * @defaultValue `0.0.0`
   *
   * @internal
   */
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
  /**
   * Report whether this module was invoked directly as the `gramstax` binary.
   *
   * @remarks
   * Guards the side-effecting `program.parseAsync` call at module scope, so
   * importing `program` from a test or another script does not start Commander's
   * dispatch. Compares `process.argv[1]` to this file's own path, then falls back
   * to a filename-suffix check because bin shims and the `.js`/`.mjs` build outputs
   * report a different path than `import.meta.url`.
   *
   * @returns `true` when this module should run the CLI, `false` when it was merely imported.
   *
   * @internal
   */
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
