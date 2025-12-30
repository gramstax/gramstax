#!/usr/bin/env node
import { log } from "./utils/log"
import { Create } from "./create"
import { Command } from "commander"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const __PKG_VERSION__ = JSON.parse(readFileSync(join(__dirname, `../../package.json`), `utf-8`)).version as string
const program = new Command()

program
  .name(`create-gramstax`)
  .description(`CLI to create a new Gramstax Telegram bot project`)
  .version(__PKG_VERSION__)
  .argument(`[project-directory]`, `Directory to create the project in`)
  .action(async (projectDirectory?: string) => {
    try {
      await new Create(projectDirectory).createProject()
    } catch (error) {
      log.error(`Failed to create project: ${String(error)}`)
      process.exit(1)
    }
  })

program.parse()
