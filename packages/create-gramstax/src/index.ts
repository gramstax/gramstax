#!/usr/bin/env node
import * as fs from "fs"
import * as path from "path"
import { log } from "./utils/logger"
import { Create } from "./create"
import { Command } from "commander"

// Read version from package.json
const packageJsonPath = path.join(__dirname, `../package.json`)
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, `utf-8`))
const version = packageJson.version || `0.0.0`
const program = new Command()

program
  .name(`create-gramstax`)
  .description(`CLI to create a new Gramstax Telegram bot project`)
  .version(version)
  .argument(`[project-directory]`, `Directory to create the project in`)
  .action(async (projectDirectory?: string) => {
    try {
      await new Create(projectDirectory, version).createProject()
    } catch (error) {
      log.error(`Failed to create project: ${String(error)}`)
      process.exit(1)
    }
  })

program.parse()
