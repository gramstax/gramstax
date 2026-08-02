#!/usr/bin/env node
import {existsSync, readFileSync} from "node:fs"
import {dirname, join} from "node:path"
import {fileURLToPath} from "node:url"
import {Command} from "commander"
import {type CliOptions, Create} from "./create"
import {log} from "./utils/log"
import {validateCliOptions} from "./utils/project"

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

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageVersion = JSON.parse(readFileSync(findPackageJson(__dirname), `utf-8`)).version as string
const program = new Command()

program
  .name(`create-gramstax`)
  .description(`CLI to create a new Gramstax Telegram bot project`)
  .version(packageVersion)
  .argument(`[project-directory]`, `Directory to create the project in`)
  .option(`--pm <name>`, `Package manager (bun, npm, pnpm, yarn)`)
  .option(`--runtime <name>`, `Runtime (bun, node)`)
  .option(`--lmdb`, `Include @gramstax/lmdb (default: true)`)
  .option(`--no-lmdb`, `Skip @gramstax/lmdb`)
  .option(`--worker-thread`, `Include @gramstax/worker-thread (default: true)`)
  .option(`--no-worker-thread`, `Skip @gramstax/worker-thread`)
  .option(`--biome`, `Include Biome for linting & formatting (default: true)`)
  .option(`--no-biome`, `Skip Biome`)
  .action(async (projectDirectory?: string, opts?: {pm: CliOptions["packageManager"]} & Omit<CliOptions, "packageManager">) => {
    try {
      validateCliOptions(opts?.pm, opts?.runtime)
      const cliOptions: CliOptions = {}
      if (opts?.pm) cliOptions.packageManager = opts.pm
      if (opts?.runtime) cliOptions.runtime = opts.runtime
      if (opts?.lmdb !== undefined) cliOptions.lmdb = opts.lmdb
      if (opts?.workerThread !== undefined) cliOptions.workerThread = opts.workerThread
      if (opts?.biome !== undefined) cliOptions.biome = opts.biome

      await new Create(projectDirectory, {
        version: packageVersion,
        cliOptions
      }).createProject()
    } catch (error) {
      log.error(`Failed to create project: ${String(error)}`)
      process.exit(1)
    }
  })

program.parse()
