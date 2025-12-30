#!/usr/bin/env node
import { log } from "./utils/log"
import { Create } from "./create"
import { Command } from "commander"

declare const __PKG_VERSION__: string
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
