#!/usr/bin/env node
import {existsSync, readFileSync} from "node:fs"
import {dirname, join} from "node:path"
import {fileURLToPath} from "node:url"
import {Command, Option} from "commander"
import {Create, type ICliOptions} from "./create"
import {log} from "./utils/log"
import {type IPackageManager, PACKAGE_MANAGERS, SetupCancelledError, validateCliOptions} from "./utils/project"

export function detectPackageManager(explicit?: string, overrides?: {userAgent?: string; cwd?: string; exists?: (p: string) => boolean}): IPackageManager {
  if (explicit !== undefined) {
    const normalized = explicit.trim().toLowerCase()
    if ((PACKAGE_MANAGERS as readonly string[]).includes(normalized)) {
      return normalized as IPackageManager
    }
  }
  const userAgent = overrides?.userAgent ?? process.env.npm_config_user_agent ?? ``
  const agent = userAgent.toLowerCase()
  if (agent.includes(`bun`)) return `bun`
  if (agent.includes(`pnpm`)) return `pnpm`
  if (agent.includes(`yarn`)) return `yarn`
  if (agent.includes(`npm`)) return `npm`
  const cwd = overrides?.cwd ?? process.cwd()
  const exists = overrides?.exists ?? existsSync
  if (exists(join(cwd, `bun.lockb`))) return `bun`
  if (exists(join(cwd, `bun.lock`))) return `bun`
  if (exists(join(cwd, `package-lock.json`))) return `npm`
  if (exists(join(cwd, `pnpm-lock.yaml`))) return `pnpm`
  if (exists(join(cwd, `yarn.lock`))) return `yarn`
  return `bun`
}

function findPackageJson(startDir: string): string {
  let dir = startDir
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, `package.json`)
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`package.json not found`)
}

function loadVersion(): string {
  try {
    const raw = readFileSync(findPackageJson(dirname(fileURLToPath(import.meta.url))), `utf-8`)
    const parsed = JSON.parse(raw) as {version?: unknown}
    if (typeof parsed.version === `string` && parsed.version.length > 0) return parsed.version
    return `0.0.0`
  } catch {
    return `0.0.0`
  }
}

const packageVersion = loadVersion()

export const program = new Command()

program
  .name(`create-gramstax`)
  .description(`CLI to create a new Gramstax Telegram bot project`)
  .version(packageVersion)
  .argument(`[project-directory]`, `Directory to create the project in`)
  .addOption(new Option(`--pm <name>`, `Package manager (bun, npm, pnpm, yarn)`).choices([`bun`, `npm`, `pnpm`, `yarn`]).argParser((value: string) => value.trim().toLowerCase()))
  .addOption(new Option(`--runtime <name>`, `Runtime (bun, node)`).choices([`bun`, `node`]).argParser((value: string) => value.trim().toLowerCase()))
  // No `true` default on these three, and that is the point. With a default,
// `opts.lmdb` is always defined, so `cli?.lmdb ?? prompted.lmdb` in `Create`
// resolved to the flag every time and a declined confirm was silently discarded —
// the prompt asked a question whose answer could not reach the outcome. Left
// undefined, "not stated on the command line" means "ask me", which is what the
// rest of the config assembly already expects.
.addOption(new Option(`--lmdb`, `Include @gramstax/lmdb (prompted when neither flag is given)`))
  .addOption(new Option(`--no-lmdb`, `Skip @gramstax/lmdb`))
  .addOption(new Option(`--worker-thread`, `Include @gramstax/worker-thread (prompted when neither flag is given)`))
  .addOption(new Option(`--no-worker-thread`, `Skip @gramstax/worker-thread`))
  .addOption(new Option(`--biome`, `Include Biome for linting & formatting (prompted when neither flag is given)`))
  .addOption(new Option(`--no-biome`, `Skip Biome for linting & formatting`))
  .option(`--skip-install`, `Skip dependency installation`)
  .exitOverride()
  .action(async (projectDirectory?: string, opts?: {pm?: string; runtime?: string; lmdb?: boolean; workerThread?: boolean; biome?: boolean; skipInstall?: boolean}) => {
    try {
      const rawPm = opts?.pm !== undefined ? opts.pm.trim().toLowerCase() : undefined
      const rawRuntime = opts?.runtime !== undefined ? opts.runtime.trim().toLowerCase() : undefined
      validateCliOptions(rawPm, rawRuntime)
      const cliOptions: ICliOptions = {}
      cliOptions.packageManager = (rawPm as ICliOptions[`packageManager`]) ?? detectPackageManager()
      if (rawRuntime !== undefined) cliOptions.runtime = rawRuntime as ICliOptions[`runtime`]
      if (opts?.lmdb !== undefined) cliOptions.lmdb = opts.lmdb
      if (opts?.workerThread !== undefined) cliOptions.workerThread = opts.workerThread
      if (opts?.biome !== undefined) cliOptions.biome = opts.biome
      if (opts?.skipInstall !== undefined) cliOptions.skipInstall = opts.skipInstall
      await new Create(projectDirectory, {
        version: packageVersion,
        cliOptions
      }).createProject()
      process.exitCode = 0
    } catch (error) {
      if (error instanceof SetupCancelledError) {
        log.info(`Setup cancelled`)
        process.exitCode = 0
        return
      }
      const message = error instanceof Error ? error.message : String(error)
      const isUsage = message.includes(`Unsupported`) || message.includes(`Missing`) || message.includes(`required`) || message.includes(`Invalid`) || message.includes(`already exists`) || message.includes(`not empty`)
      if (isUsage) {
        log.error(message)
        process.exitCode = 2
        return
      }
      log.error(`Failed to create project: ${message}`)
      process.exitCode = 1
    }
  })

function isMainModule(): boolean {
  const argv1 = process.argv[1] ?? ``
  if (argv1 === ``) return false
  try {
    const current = fileURLToPath(import.meta.url)
    if (argv1 === current) return true
    if (argv1.endsWith(`create-gramstax`) || argv1.endsWith(`index.js`)) return true
    return false
  } catch {
    return false
  }
}

if (isMainModule()) {
  try {
    program.parse()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes(`helpDisplayed`) || message.includes(`version`)) {
      process.exitCode = 0
    } else {
      log.error(message)
      process.exitCode = 2
    }
  }
}
