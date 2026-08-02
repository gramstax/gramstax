import {spawn} from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import {fileURLToPath} from "node:url"
import enquirer from "enquirer"
import {FsUt} from "./utils/fs"
import {log} from "./utils/log"
import {
  appendEnvDbPath,
  appendGitignoreEntries,
  isValidProjectName,
  removeDependency,
  removeTsconfigPathMappings,
  replaceTemplateVariables,
  resolveRuntimeScripts,
  resolveWorkspaceDeps,
  sanitizeProjectName,
  SetupCancelledError,
  stripBiomeScripts,
  validateCliOptions,
  type PackageManager,
  type Runtime
} from "./utils/project"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export type CliOptions = {
  packageManager?: PackageManager
  runtime?: Runtime
  lmdb?: boolean
  workerThread?: boolean
  biome?: boolean
}

type ProjectConfig = {
  projectName: string
  projectPath: string
  packageManager: PackageManager
  runtime: Runtime
  setupBiome: boolean
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
        content = replaceTemplateVariables(content, variables)
        fs.writeFileSync(destPath, content)
      }
    }
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
        if (!/^[a-z0-9-_]{1,100}$/i.test(value)) return `Project name can only contain letters, numbers, hyphens, and underscores (max 100 characters)`
        return true
      }
    })
    return response.projectName
  }

  private async promptForConfiguration(): Promise<{
    packageManager: PackageManager
    runtime: Runtime
    biome: boolean
    lmdb: boolean
    workerThread: boolean
  }> {
    const answers = await enquirer.prompt<{
      packageManager?: PackageManager
      runtime: Runtime
      lmdb?: boolean
      workerThread?: boolean
      biome?: boolean
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
        name: `biome`,
        message: `Would you like to use Biome for linting & formatting? (recommended)`,
        initial: true
      }
    ])
    if (!answers?.packageManager) {
      throw new SetupCancelledError()
    }
    return {
      packageManager: answers.packageManager,
      runtime: answers.runtime,
      lmdb: answers.lmdb as boolean,
      workerThread: answers.workerThread as boolean,
      biome: answers.biome as boolean
    }
  }

  private async installDependencies(projectPath: string, packageManager: PackageManager): Promise<boolean> {
    return await new Promise((resolve) => {
      const installProcess = spawn(FsUt.resolvePackageManagerCommand(packageManager), [`install`], {
        cwd: projectPath,
        stdio: `inherit`,
        shell: FsUt.resolveSpawnShell(packageManager)
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

    if (projectName && !isValidProjectName(projectName)) {
      throw new Error(`Invalid project name "${projectName}". Use only letters, numbers, hyphens, and underscores (max 100 characters).`)
    }

    if (!projectName) {
      if (cli && this._hasAnyCliFlag()) {
        log.error(`Project name is required when using CLI flags`)
        throw new Error(`Missing project name`)
      }
      projectName = await this.promptForProjectName()
      if (projectName === ``) {
        projectName = sanitizeProjectName(path.basename(baseWorkingDir))
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
    let config: {
      packageManager: PackageManager
      runtime: Runtime
      lmdb: boolean
      workerThread: boolean
      biome: boolean
    }
    if (hasCli) {
      validateCliOptions(cli!.packageManager, cli!.runtime)
      config = {
        packageManager: cli!.packageManager ?? `bun`,
        runtime: cli!.runtime ?? `bun`,
        lmdb: cli!.lmdb ?? true,
        workerThread: cli!.workerThread ?? true,
        biome: cli!.biome ?? true
      }
    } else {
      config = await this.promptForConfiguration()
    }

    const {packageManager, runtime, lmdb, workerThread, biome} = config

    // Summary
    log.info(`Project: ${projectName}`)
    log.info(`Location: ${projectPath}`)
    log.info(`Package Manager: ${packageManager}`)
    log.info(`Runtime: ${runtime}`)
    log.info(`LMDB Storage: ${lmdb ? `Yes` : `No`}`)
    log.info(`Worker Thread: ${workerThread ? `Yes` : `No`}`)
    log.info(`Biome: ${biome ? `Yes` : `No`}`)

    // Validation
    if (useCurrentDir) {
      if (!FsUt.isDirectoryEffectivelyEmpty(projectPath)) throw new Error(`Current directory is not empty`)
    } else {
      if (fs.existsSync(projectPath)) throw new Error(`Directory "${projectName}" already exists`)
    }

    return {
      projectName,
      projectPath,
      packageManager,
      runtime,
      setupBiome: biome,
      useLmdb: lmdb,
      useWorkerThread: workerThread
    }
  }

  private _hasAnyCliFlag(): boolean {
    const c = this.cliOptions
    return !!(c && (c.packageManager !== undefined || c.runtime !== undefined || c.lmdb !== undefined || c.workerThread !== undefined || c.biome !== undefined))
  }

  // ── Project generation ──────────────────────────────────────────

  private async executeProjectGeneration(config: ProjectConfig): Promise<void> {
    const {projectName, projectPath, packageManager, runtime, setupBiome, useLmdb, useWorkerThread} = config
    const commands = this.getPackageManagerCommands(packageManager)
    const variables = {
      projectName,
      installCmd: commands.install,
      runDevCmd: commands.dev,
      runStartCmd: commands.start
    }

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

    // Task 4b: .gitignore (shipped as `gitignore` because npm never publishes .gitignore files)
    FsUt.normalizeGitignoreFile(projectPath)

    // Task 5: Adjust scripts for Node runtime (the template defaults to bun commands)
    const packageJsonPath = path.join(projectPath, `package.json`)
    if (runtime !== `bun`) {
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, `utf-8`)) as {scripts?: Record<string, string>}
        if (pkg.scripts) {
          pkg.scripts = resolveRuntimeScripts(runtime, pkg.scripts)
          fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, `utf8`)
        }
      }
    }

    // Task 5b: Resolve workspace:* deps to concrete versions (scaffolded
    // projects are standalone — workspace:* only works inside the monorepo)
    if (this.version !== undefined && fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, `utf-8`)) as {dependencies?: Record<string, string>}
      resolveWorkspaceDeps(pkg, this.version)
      fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, `utf8`)
    }

    // Task 6: LMDB
    const dbPath = path.join(projectPath, `src`, `db`)
    if (useLmdb) {
      log.info(`Keeping @gramstax/lmdb files..`)
      if (fs.existsSync(envPath)) {
        fs.writeFileSync(envPath, appendEnvDbPath(fs.readFileSync(envPath, `utf-8`)))
      }
      const gitignorePath = path.join(projectPath, `.gitignore`)
      if (fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, appendGitignoreEntries(fs.readFileSync(gitignorePath, `utf-8`), [`data/`]))
      }
    } else {
      log.info(`Removing @gramstax/lmdb files..`)
      if (fs.existsSync(dbPath)) fs.rmSync(dbPath, {recursive: true, force: true})
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, `utf-8`)) as {dependencies?: Record<string, string>}
        removeDependency(pkg, `@gramstax/lmdb`)
        fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, `utf8`)
      }
      const tsconfigPath = path.join(projectPath, `tsconfig.json`)
      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = removeTsconfigPathMappings(fs.readFileSync(tsconfigPath, `utf-8`), [`@gramstax/lmdb`])
        fs.writeFileSync(tsconfigPath, tsconfig, `utf8`)
      }
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

    // Task 9: Biome
    const biomeJsonPath = path.join(projectPath, `biome.json`)
    if (setupBiome) {
      log.info(`Installing Biome dependencies..`)
      const installCmd = FsUt.resolvePackageManagerCommand(packageManager)
      const installArgs = packageManager === `yarn` ? [`add`, `-D`] : [`install`, `-D`]
      installArgs.push(`@biomejs/biome`)
      const installResult = await new Promise<boolean>((resolve) => {
        const p = spawn(installCmd, installArgs, {
          cwd: projectPath,
          stdio: `inherit`,
          shell: FsUt.resolveSpawnShell(packageManager)
        })
        p.on(`close`, (code) => resolve(code === 0))
        p.on(`error`, (err) => {
          log.fail(`Failed to install Biome: ${err.message}`)
          resolve(false)
        })
      })
      if (!installResult) {
        log.fail(`Biome installation failed — run "${packageManager} ${installArgs.join(` `)}" manually`)
      }
    } else {
      if (fs.existsSync(biomeJsonPath)) fs.unlinkSync(biomeJsonPath)
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, `utf-8`)) as {scripts?: Record<string, string>}
        stripBiomeScripts(pkg)
        fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, `utf8`)
      }
    }

    log.info(`Project created successfully!`)
    log.info(`Next steps: ${config.projectPath !== process.cwd() ? `cd ${path.basename(config.projectPath)} && ` : ``}${commands.install} && ${commands.dev}`)
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
