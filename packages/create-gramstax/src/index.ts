#!/usr/bin/env node
import {log} from "./utils/log"
import {Create} from "./create"
import {Command} from "commander"
import {readFileSync} from "node:fs"
import {dirname, join} from "node:path"
import {fileURLToPath} from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJsonPath = join(__dirname, `../../package.json`)
const packageVersion = JSON.parse(readFileSync(packageJsonPath, `utf-8`)).version as string
const program = new Command()

program
  .name(`create-gramstax`)
  .description(`CLI to create a new Gramstax Telegram bot project`)
  .version(packageVersion)
  .argument(`[project-directory]`, `Directory to create the project in`)
  .action(async (projectDirectory?: string) => {
    try {
      await new Create(projectDirectory, {version: packageVersion}).createProject()
    } catch (error) {
      log.error(`Failed to create project: ${String(error)}`)
      process.exit(1)
    }
  })

program.parse()
