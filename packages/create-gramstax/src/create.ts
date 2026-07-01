import * as fs from "node:fs"
import * as path from "node:path"
import {fileURLToPath} from "node:url"
import {log} from "./utils/log"
import {FsUt} from "./utils/fs"
import {spawn} from "node:child_process"
import enquirer from "enquirer"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type Runtime = `bun` | `node`
type PackageManager = `bun` | `npm` | `pnpm` | `yarn`

export type CliOptions = {
  packageManager?: PackageManager
  runtime?: Runtime
  lmdb?: boolean
  workerThread?: boolean
  eslint?: boolean
}

type ProjectConfig = {
  projectName: string
  projectPath: string
  packageManager: PackageManager
  runtime: Runtime
  setupEslint: boolean
  useLmdb: boolean
  useWorkerThread: boolean
}

export class Create {
  private config: ProjectConfig | undefined
  private version: string | undefined
  private cliOptions: CliOptions | undefined

  constructor(
    private projectDirectory?: string,
    options?: {version?: string; cliOptions?: CliOptions}
  ) {
    this.version = options?.version
    this.cliOptions = options?.cliOptions
  }

  printBanner() {
    const banner = `
 $$$$$$\\                                               $$\\                         
$$  __$$\\                                              $$ |                        
$$ /  \\__| $$$$$$\\  $$$$$$\\  $$$$$$\\$$$$\\   $$$$$$$\\ $$$$$$\\    $$$$$$\\  $$\\   $$\\ 
$$ |$$$$\\ $$  __$$\\ \\____$$\\ $$  _$$  _$$\\ $$  _____|\\_$$  _|   \\____$$\\ \\$$\\ $$  |
$$ |\\_$$ |$$ |  \\__|$$$$$$$ |$$ / $$ / $$ |\\$$$$$$\\    $$ |     $$$$$$$ | \\$$$$  / 
$$ |  $$ |$$ |     $$  __$$ |$$ | $$ | $$ | \\____$$\\   $$ |$$\\ $$  __$$ | $$  $$<  
 \\$$$$$$  |$$ |     \\$$$$$$$ |$$ | $$ | $$ |$$$$$$$  |  \\$$$$  |\\$$$$$$$ |$$  /\\$$\\ 
 \\______/ \\__|      \\_______|\\__| \\__| \\__|\\_______/    \\____/  \\_______|\\__/  \\__|
                                                                                                                                              
`
    const versionLine = this.version ? `v${this.version}` : `v0.0.0`
    console.log(`${banner}${versionLine}\n`)
  }

  private getPackageManagerCommands(packageManager: PackageManager) {
    const commands = {
      bun: {install: `bun install`, dev: `bun dev`, start: `bun start`},
      npm: {install: `npm install`, dev: `npm run dev`, start: `npm start`},
      pnpm: {install: `pnpm install`, dev: `pnpm dev`, start: `pnpm start`},
      yarn: {install: `yarn install`, dev: `yarn dev`, start: `yarn start`}
    }
    return commands[packageManager]
  }

  private copyDirectorySync(source: string, destination: string, variables: Record<string, string> = {}) {
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, {recursive: true})
    }
    const items = fs.readdirSync(source, {withFileTypes: true})
    for (const item of items) {
      const sourcePath = path.join(source, item.name)
      const destPath = path.join(destination, item.name)
      if (item.isDirectory()) {
        this.copyDirectorySync(sourcePath, destPath, variables)
      } else if (item.isFile()) {
        let content = fs.readFileSync(sourcePath, `utf-8`)
        content = this.replaceTemplateVariables(content, variables)
        fs.writeFileSync(destPath, content)
      }
    }
  }

  private replaceTemplateVariables(content: string, variables: Record<string, string>): string {
    let result = content
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, `g`), value)
    }
    return result
  }

  // ── Prompts (only used in interactive mode) ──────────────────────

  private async promptForProjectName(): Promise<string> {
    const response = await enquirer.prompt<{projectName: string}>({
      type: `input`,
      name: `projectName`,
      message: `What is your project named?`,
      initial: ``,
      validate: (value: string) => {
        if (value === ``) return true
        if (!/^[a-z0-9-_]+$/i.test(value)) return `Project name can only contain letters, numbers, hyphens, and underscores`
        return true
      }
    })
    return response.projectName
  }

  private async promptForConfiguration(): Promise<{packageManager: PackageManager; runtime: Runtime; eslint: boolean; lmdb: boolean; workerThread: boolean}> {
    const answers = await enquirer.prompt<{
      packageManager?: PackageManager
      runtime: Runtime
      lmdb?: boolean
      workerThread?: boolean
      eslint?: boolean
    }>([
      {
        type: `select`,
        name: `packageManager`,
        message: `Which package manager would you like to use?`,
        choices: [
          {name: `bun`, message: `Bun (recommended)`, value: `bun`},
          {name: `npm`, message: `npm`, value: `npm`},
          {name: `pnpm`, message: `pnpm`, value: `pnpm`},
          {name: `yarn`, message: `Yarn`, value: `yarn`}
        ],
        initial: 0
      },
      {
        type: `select`,
        name: `runtime`,
        message: `Which runtime would you like to use?`,
        choices: [
          {name: `bun`, message: `Bun (recommended)`, value: `bun`},
          {name: `node`, message: `Node.js`, value: `node`}
        ],
        initial: 0
      },
      {
        type: `confirm`,
        name: `lmdb`,
        message: `Would you like to include @gramstax/lmdb for persistent storage? (recommended)`,
        initial: true
      },
      {
        type: `confirm`,
        name: `workerThread`,
        message: `Would you like to include @gramstax/worker-thread for background jobs? (recommended)`,
        initial: true
      },
      {
        type: `confirm`,
        name: `eslint`,
        message: `Would you like to use ESLint?`,
        initial: true
      }
    ])
    return {
      packageManager: answers.packageManager as any,
      runtime: answers.runtime,
      lmdb: answers.lmdb as boolean,
      workerThread: answers.workerThread as boolean,
      eslint: answers.eslint as boolean
    }
  }

  private async installDependencies(projectPath: string, packageManager: PackageManager): Promise<boolean> {
    return await new Promise((resolve) => {
      const installProcess = spawn(FsUt.resolvePackageManagerCommand(packageManager), [`install`], {
        cwd: projectPath,
        stdio: `inherit`,
        shell: false
      })
      installProcess.on(`close`, (code) => (code === 0 ? resolve(true) : (log.fail(`Dependencies installation failed`), resolve(false))))
      installProcess.on(`error`, (error) => (log.fail(`Dependencies installation failed: ${error.message}`), resolve(false)))
    })
  }

  // ── Configuration gathering ─────────────────────────────────────

  private async gatherProjectConfig(): Promise<ProjectConfig> {
    this.printBanner()
    const cli = this.cliOptions
    const baseWorkingDir = FsUt.resolveInitialWorkingDirectory()

    // Determine project name and path
    let projectName = this.projectDirectory ?? ``
    let projectPath: string
    let useCurrentDir = false

    if (!projectName) {
      if (cli && this._hasAnyCliFlag()) {
        log.error(`Project name is required when using CLI flags`)
        throw new Error(`Missing project name`)
      }
      projectName = await this.promptForProjectName()
      if (projectName === ``) {
        projectName = path.basename(baseWorkingDir)
        projectPath = baseWorkingDir
        useCurrentDir = true
      } else {
        projectPath = path.resolve(baseWorkingDir, projectName)
      }
    } else {
      projectPath = path.resolve(baseWorkingDir, projectName)
    }

    // Gather config — skip prompts if CLI options provided
    const hasCli = cli && this._hasAnyCliFlag()
    const config = hasCli ? {packageManager: cli!.packageManager ?? (`bun` as PackageManager), runtime: cli!.runtime ?? (`bun` as Runtime), lmdb: cli!.lmdb ?? true, workerThread: cli!.workerThread ?? true, eslint: cli!.eslint ?? true} : await this.promptForConfiguration()

    const {packageManager, runtime, lmdb, workerThread, eslint} = config

    // Summary
    log.info(`Project: ${projectName}`)
    log.info(`Location: ${projectPath}`)
    log.info(`Package Manager: ${packageManager}`)
    log.info(`Runtime: ${runtime}`)
    log.info(`LMDB Storage: ${lmdb ? `Yes` : `No`}`)
    log.info(`Worker Thread: ${workerThread ? `Yes` : `No`}`)
    log.info(`ESLint: ${eslint ? `Yes` : `No`}`)

    // Validation
    if (useCurrentDir) {
      if (!FsUt.isDirectoryEffectivelyEmpty(projectPath)) throw new Error(`Current directory is not empty`)
    } else {
      if (fs.existsSync(projectPath)) throw new Error(`Directory "${projectName}" already exists`)
    }

    return {projectName, projectPath, packageManager, runtime, setupEslint: eslint, useLmdb: lmdb, useWorkerThread: workerThread}
  }

  private _hasAnyCliFlag(): boolean {
    const c = this.cliOptions
    return !!(c && (c.packageManager !== undefined || c.runtime !== undefined || c.lmdb !== undefined || c.workerThread !== undefined || c.eslint !== undefined))
  }

  // ── Project generation ──────────────────────────────────────────

  private async executeProjectGeneration(config: ProjectConfig): Promise<void> {
    const {projectName, projectPath, packageManager, runtime, setupEslint, useLmdb, useWorkerThread} = config
    const commands = this.getPackageManagerCommands(packageManager)
    const variables = {projectName, installCmd: commands.install, runDevCmd: commands.dev, runStartCmd: commands.start}

    // Task 1: Directory
    log.info(`Creating project directory..`)
    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, {recursive: true})

    // Task 2: Copy templates
    log.info(`Copying template files..`)
    this.copyDirectorySync(path.join(__dirname, `templates`), projectPath, variables)

    // Task 3: Logs
    log.info(`Creating logs directory..`)
    fs.mkdirSync(path.join(projectPath, `logs`), {recursive: true})
    fs.writeFileSync(path.join(projectPath, `logs/.gitkeep`), ``)

    // Task 4: .env
    const envPath = path.join(projectPath, `.env`)
    const envExamplePath = path.join(projectPath, `.env.example`)
    if (fs.existsSync(envExamplePath)) {
      log.info(`Creating .env file..`)
      fs.renameSync(envExamplePath, envPath)
    }

    // Task 5: Remove bunfig if Node
    if (runtime !== `bun`) {
      const bunfigPath = path.join(projectPath, `bunfig.toml`)
      if (fs.existsSync(bunfigPath)) fs.unlinkSync(bunfigPath)
    }

    // Task 6: LMDB
    const dbPath = path.join(projectPath, `src`, `db`)
    if (useLmdb) {
      log.info(`Keeping @gramstax/lmdb files..`)
      const envContent = fs.readFileSync(envPath, `utf-8`)
      fs.writeFileSync(envPath, envContent + `\n\nDB_PATH="./data"\n`)
    } else {
      log.info(`Removing @gramstax/lmdb files..`)
      if (fs.existsSync(dbPath)) fs.rmSync(dbPath, {recursive: true, force: true})
    }

    // Task 7: Worker Thread
    const workerPath = path.join(projectPath, `src`, `workers`)
    if (useWorkerThread) {
      log.info(`Keeping @gramstax/worker-thread files..`)
    } else {
      log.info(`Removing @gramstax/worker-thread files..`)
      if (fs.existsSync(workerPath)) fs.rmSync(workerPath, {recursive: true, force: true})
    }

    // Task 8: Install
    log.info(`Installing dependencies..`)
    if (!(await this.installDependencies(projectPath, packageManager))) throw new Error(`Dependencies installation failed`)

    // Task 9: ESLint
    const befEslint = path.join(projectPath, `eslint.config.ts.template`)
    const aftEslint = path.join(projectPath, `eslint.config.ts`)
    if (setupEslint) {
      log.info(`Installing ESLint dependencies..`)
      const installCmd = FsUt.resolvePackageManagerCommand(packageManager)
      const installArgs = packageManager === `yarn` ? [`add`, `-D`] : [`install`, `-D`]
      installArgs.push(`eslint`, `@eslint/js`, `globals`, `typescript-eslint`)
      await new Promise<void>((resolve) => {
        const p = spawn(installCmd, installArgs, {cwd: projectPath, stdio: `inherit`, shell: false})
        p.on(`close`, () => resolve())
        p.on(`error`, (err) => {
          log.fail(`Failed to install ESLint: ${err.message}`)
          resolve()
        })
      })
      if (fs.existsSync(befEslint)) fs.renameSync(befEslint, aftEslint)
    } else {
      if (fs.existsSync(befEslint)) fs.unlinkSync(befEslint)
    }

    log.info(`Project created successfully!`)
    log.info(`Next steps: ${config.projectPath !== process.cwd() ? `cd ${projectName} && ` : ``}${commands.install} && ${commands.dev}`)
    log.info(`Done..`)
  }

  // ── Entry point ─────────────────────────────────────────────────

  async createProject() {
    try {
      this.config = await this.gatherProjectConfig()
      await this.executeProjectGeneration(this.config)
    } catch (error) {
      log.error(`Failed to create project: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  }
}
