#!/usr/bin/env node
import {log} from "./utils/log"
import {Create, type CliOptions} from "./create"
import {Command} from "commander"
import {readFileSync} from "node:fs"
import {join} from "node:path"
import {fileURLToPath} from "node:url"

const __dirname = fileURLToPath(import.meta.url)
const packageVersion = JSON.parse(readFileSync(join(__dirname, `../../package.json`), `utf-8`)).version as string
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
  .option(`--eslint`, `Include ESLint (default: true)`)
  .option(`--no-eslint`, `Skip ESLint`)
  .action(async (projectDirectory?: string, opts?: Record<string, any>) => {
    try {
      const cliOptions: CliOptions = {}
      if (opts?.pm) cliOptions.packageManager = opts.pm
      if (opts?.runtime) cliOptions.runtime = opts.runtime
      if (opts?.lmdb !== undefined) cliOptions.lmdb = opts.lmdb
      if (opts?.workerThread !== undefined) cliOptions.workerThread = opts.workerThread
      if (opts?.eslint !== undefined) cliOptions.eslint = opts.eslint

      await new Create(projectDirectory, {version: packageVersion, cliOptions}).createProject()
    } catch (error) {
      log.error(`Failed to create project: ${String(error)}`)
      process.exit(1)
    }
  })

program.parse()
