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
  assertNoLeftoverPlaceholders,
  BIOME_DEV_VERSION,
  type IPackageManager,
  type IRuntime,
  isValidProjectName,
  PROJECT_NAME_PATTERN,
  removeDependency,
  removeTsconfigPathMappings,
  replaceTemplateVariables,
  resolveRuntimeScripts,
  resolveWorkspaceDeps,
  SetupCancelledError,
  sanitizeProjectName,
  setTsconfigCompilerOptions,
  stripBiomeScripts,
  validateCliOptions,
  writeJsonFileAtomic,
  writeTextFileAtomic
} from "./utils/project"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export type ICliOptions = {
  packageManager?: IPackageManager
  runtime?: IRuntime
  lmdb?: boolean
  workerThread?: boolean
  biome?: boolean
  skipInstall?: boolean
}

type IProjectConfig = {
  projectName: string
  projectPath: string
  packageManager: IPackageManager
  runtime: IRuntime
  setupBiome: boolean
  useLmdb: boolean
  useWorkerThread: boolean
  skipInstall?: boolean
}

export class Create {
  private _config: IProjectConfig | undefined
  private _version: string | undefined
  private _cliOptions: ICliOptions | undefined

  constructor(
    private _projectDirectory?: string,
    options?: {
      version?: string
      cliOptions?: ICliOptions
    }
  ) {
    this._version = options?.version
    this._cliOptions = options?.cliOptions
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
    const versionLine = this._version ? `v${this._version}` : `v0.0.0`
    console.log(`${banner}${versionLine}\n`)
  }

  getPackageManagerCommands(packageManager: IPackageManager) {
    const commands = {
      bun: {install: `bun install`, dev: `bun dev`, start: `bun start`},
      npm: {install: `npm install`, dev: `npm run dev`, start: `npm start`},
      pnpm: {install: `pnpm install`, dev: `pnpm dev`, start: `pnpm start`},
      yarn: {install: `yarn install`, dev: `yarn dev`, start: `yarn start`}
    }
    return commands[packageManager]
  }

  copyDirectorySync(source: string, destination: string, variables: Record<string, string> = {}) {
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, {recursive: true})
    }
    const items = fs.readdirSync(source, {withFileTypes: true})
    for (const item of items) {
      const sourcePath = path.join(source, item.name)
      const destPath = path.join(destination, item.name)
      if (item.isSymbolicLink()) {
        log.warn(`Skipping symlink ${sourcePath}..`)
        continue
      }
      if (item.isDirectory()) {
        this.copyDirectorySync(sourcePath, destPath, variables)
      } else if (item.isFile()) {
        const stat = fs.statSync(sourcePath)
        const raw = fs.readFileSync(sourcePath)
        let isText = !raw.includes(0)
        if (isText) {
          try {
            new TextDecoder(`utf-8`, {fatal: true}).decode(raw)
          } catch {
            isText = false
          }
        }
        if (!isText) {
          fs.copyFileSync(sourcePath, destPath)
          fs.chmodSync(destPath, stat.mode)
          continue
        }
        const content = replaceTemplateVariables(raw.toString(`utf-8`), variables)
        fs.writeFileSync(destPath, content)
        fs.chmodSync(destPath, stat.mode)
      }
    }
  }

  // ── Prompts (only used in interactive mode) ──────────────────────

  async promptForProjectName(): Promise<string> {
    let response: {projectName: string} | undefined
    try {
      response = await enquirer.prompt<{projectName: string}>({
        type: `input`,
        name: `projectName`,
        message: `What is your project named?`,
        initial: ``,
        validate: (value: string) => {
          if (value.trim() === ``) return true
          if (!PROJECT_NAME_PATTERN.test(value.trim())) return `Project name can only contain letters, numbers, hyphens, and underscores (max 100 characters)`
          return true
        }
      })
    } catch {
      throw new SetupCancelledError()
    }
    if (!response || typeof response.projectName !== `string`) {
      throw new SetupCancelledError()
    }
    return response.projectName.trim()
  }

  async promptForConfiguration(): Promise<{
    packageManager: IPackageManager
    runtime: IRuntime
    biome: boolean
    lmdb: boolean
    workerThread: boolean
  }> {
    const answers = await enquirer
      .prompt<{
        packageManager?: IPackageManager
        runtime: IRuntime
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
      .catch(() => {
        throw new SetupCancelledError()
      })
    if (!answers?.packageManager || !answers?.runtime || answers?.lmdb === undefined || answers?.workerThread === undefined || answers?.biome === undefined) {
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

  async installDependencies(projectPath: string, packageManager: IPackageManager): Promise<boolean> {
    return await new Promise((resolve) => {
      const installProcess = spawn(FsUt.resolvePackageManagerCommand(packageManager), [`install`], {
        cwd: projectPath,
        stdio: `inherit`,
        shell: FsUt.resolveSpawnShell(packageManager)
      })
      installProcess.on(`close`, (code) => resolve(code === 0))
      installProcess.on(`error`, () => resolve(false))
    })
  }

  // ── Configuration gathering ─────────────────────────────────────

  async gatherProjectConfig(): Promise<IProjectConfig> {
    this.printBanner()
    const cli = this._cliOptions
    const baseWorkingDir = FsUt.resolveInitialWorkingDirectory()

    // Determine project name and path
    let projectName = this._projectDirectory ?? ``
    let projectPath: string
    let useCurrentDir = false

    if (projectName && !isValidProjectName(projectName)) {
      throw new Error(`Invalid project name "${projectName}". Use only letters, numbers, hyphens, and underscores (max 100 characters).`)
    }

    const isTTY = process.stdin?.isTTY === true
    const hasAnyFlag = Boolean(cli && (this.hasAnyCliFlag() || cli.skipInstall !== undefined))
    const normalizedPm = cli?.packageManager !== undefined ? (String(cli!.packageManager).trim().toLowerCase() as IPackageManager) : undefined
    const normalizedRuntime = cli?.runtime !== undefined ? (String(cli!.runtime).trim().toLowerCase() as IRuntime) : undefined

    if (!projectName) {
      if (!isTTY) {
        if (hasAnyFlag) {
          log.error(`Project name is required when using CLI flags`)
        }
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
    const hasCli = hasAnyFlag
    let config: {
      packageManager: IPackageManager
      runtime: IRuntime
      lmdb: boolean
      workerThread: boolean
      biome: boolean
    }
    if (hasCli) {
      validateCliOptions(normalizedPm, normalizedRuntime)
      const detectPackageManagerFallback = (): IPackageManager => {
        if (normalizedPm !== undefined) return normalizedPm
        const agent = (process.env.npm_config_user_agent ?? ``).toLowerCase()
        if (agent.includes(`bun`)) return `bun`
        if (agent.includes(`pnpm`)) return `pnpm`
        if (agent.includes(`yarn`)) return `yarn`
        if (agent.includes(`npm`)) return `npm`
        if (fs.existsSync(path.join(baseWorkingDir, `bun.lockb`))) return `bun`
        if (fs.existsSync(path.join(baseWorkingDir, `bun.lock`))) return `bun`
        if (fs.existsSync(path.join(baseWorkingDir, `package-lock.json`))) return `npm`
        if (fs.existsSync(path.join(baseWorkingDir, `pnpm-lock.yaml`))) return `pnpm`
        if (fs.existsSync(path.join(baseWorkingDir, `yarn.lock`))) return `yarn`
        return `bun`
      }
      const fallbackPm = detectPackageManagerFallback()
      const missing: string[] = []
      if (normalizedRuntime === undefined) missing.push(`runtime`)
      if (cli?.lmdb === undefined) missing.push(`lmdb`)
      if (cli?.workerThread === undefined) missing.push(`workerThread`)
      if (cli?.biome === undefined) missing.push(`biome`)
      if (missing.length > 0) {
        if (!isTTY) {
          throw new Error(`Missing required CLI options: ${missing.join(`, `)}. Provide ${missing.join(`, `)} flags or run interactively.`)
        }
        const prompted = await this.promptForConfiguration()
        config = {
          packageManager: normalizedPm ?? fallbackPm,
          runtime: normalizedRuntime ?? prompted.runtime,
          lmdb: cli?.lmdb ?? prompted.lmdb,
          workerThread: cli?.workerThread ?? prompted.workerThread,
          biome: cli?.biome ?? prompted.biome
        }
      } else {
        config = {
          packageManager: normalizedPm ?? fallbackPm,
          runtime: normalizedRuntime ?? `bun`,
          lmdb: cli?.lmdb ?? true,
          workerThread: cli?.workerThread ?? true,
          biome: cli?.biome ?? true
        }
      }
    } else {
      config = await this.promptForConfiguration()
    }

    const {packageManager, runtime, lmdb, workerThread, biome} = config

    // Validation
    if (useCurrentDir) {
      if (!FsUt.isDirectoryEffectivelyEmpty(projectPath)) throw new Error(`Current directory is not empty`)
    } else {
      if (fs.existsSync(projectPath)) throw new Error(`Directory "${projectName}" already exists`)
    }

    // Summary
    log.info(`Project: ${projectName}`)
    log.info(`Location: ${projectPath}`)
    log.info(`Package Manager: ${packageManager}`)
    log.info(`Runtime: ${runtime}`)
    log.info(`LMDB Storage: ${lmdb ? `Yes` : `No`}`)
    log.info(`Worker Thread: ${workerThread ? `Yes` : `No`}`)
    log.info(`Biome: ${biome ? `Yes` : `No`}`)

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

  hasAnyCliFlag(): boolean {
    const c = this._cliOptions
    return !!(c && (c.packageManager !== undefined || c.runtime !== undefined || c.lmdb !== undefined || c.workerThread !== undefined || c.biome !== undefined))
  }

  // ── Project generation ──────────────────────────────────────────

  async executeProjectGeneration(config: IProjectConfig): Promise<void> {
    const {projectName, projectPath, packageManager, runtime, setupBiome, useLmdb, useWorkerThread} = config
    const skipInstall = config.skipInstall === true
    const commands = this.getPackageManagerCommands(packageManager)
    const variables = {
      projectName,
      packageName: projectName.toLowerCase(),
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
    assertNoLeftoverPlaceholders(projectPath)

    // Task 3: Logs
    log.info(`Creating logs directory..`)
    fs.mkdirSync(path.join(projectPath, `logs`), {recursive: true})
    fs.writeFileSync(path.join(projectPath, `logs/.gitkeep`), ``)

    // Task 4: .env
    const envPath = path.join(projectPath, `.env`)
    const envExamplePath = path.join(projectPath, `.env.example`)
    if (fs.existsSync(envExamplePath)) {
      log.info(`Creating .env file..`)
      if (fs.existsSync(envPath)) {
        fs.unlinkSync(envExamplePath)
      } else {
        fs.renameSync(envExamplePath, envPath)
      }
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
          writeJsonFileAtomic(packageJsonPath, pkg)
        }
      }
      // The node build emits via tsc, so the template's noEmit must be off
      const tsconfigJsonPath = path.join(projectPath, `tsconfig.json`)
      if (fs.existsSync(tsconfigJsonPath)) {
        writeTextFileAtomic(tsconfigJsonPath, setTsconfigCompilerOptions(fs.readFileSync(tsconfigJsonPath, `utf-8`), {noEmit: false}))
      }
    }

    // Task 5b: Resolve workspace:* deps to concrete versions (scaffolded
    // projects are standalone — workspace:* only works inside the monorepo)
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, `utf-8`)) as {dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string>; optionalDependencies?: Record<string, string>}
      resolveWorkspaceDeps(pkg, this._version)
      writeJsonFileAtomic(packageJsonPath, pkg)
    }

    // Task 6: LMDB
    const dbPath = path.join(projectPath, `src`, `db`)
    const tsconfigPath = path.join(projectPath, `tsconfig.json`)
    if (useLmdb) {
      log.info(`Keeping @gramstax/lmdb files..`)
      if (fs.existsSync(envPath)) {
        writeTextFileAtomic(envPath, appendEnvDbPath(fs.readFileSync(envPath, `utf-8`)))
      }
      const gitignorePath = path.join(projectPath, `.gitignore`)
      if (fs.existsSync(gitignorePath)) {
        writeTextFileAtomic(gitignorePath, appendGitignoreEntries(fs.readFileSync(gitignorePath, `utf-8`), [`data/`]))
      }
      if (fs.existsSync(tsconfigPath)) {
        writeTextFileAtomic(tsconfigPath, removeTsconfigPathMappings(fs.readFileSync(tsconfigPath, `utf-8`), [`gramstax`, `@gramstax/lmdb`, `@gramstax/worker-thread`]))
      }
    } else {
      log.info(`Removing @gramstax/lmdb files..`)
      if (fs.existsSync(dbPath)) fs.rmSync(dbPath, {recursive: true, force: true})
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, `utf-8`)) as {dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string>; optionalDependencies?: Record<string, string>}
        removeDependency(pkg, `@gramstax/lmdb`)
        writeJsonFileAtomic(packageJsonPath, pkg)
      }
      if (fs.existsSync(tsconfigPath)) {
        writeTextFileAtomic(tsconfigPath, removeTsconfigPathMappings(fs.readFileSync(tsconfigPath, `utf-8`), [`gramstax`, `@gramstax/lmdb`, `@gramstax/worker-thread`]))
      }
    }

    // Task 7: Worker Thread
    const workerPath = path.join(projectPath, `src`, `workers`)
    if (useWorkerThread) {
      log.info(`Keeping @gramstax/worker-thread files..`)
    } else {
      log.info(`Removing @gramstax/worker-thread files..`)
      if (fs.existsSync(workerPath)) fs.rmSync(workerPath, {recursive: true, force: true})
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, `utf-8`)) as {dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string>; optionalDependencies?: Record<string, string>}
        removeDependency(pkg, `@gramstax/worker-thread`)
        writeJsonFileAtomic(packageJsonPath, pkg)
      }
    }

    // Task 9: Biome (runs before Task 8 so a single install covers it —
    // there is no per-package-manager second install pass anymore)
    const biomeJsonPath = path.join(projectPath, `biome.json`)
    if (setupBiome) {
      log.info(`Keeping Biome configuration..`)
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, `utf-8`)) as {devDependencies?: Record<string, string>}
        pkg.devDependencies ??= {}
        pkg.devDependencies[`@biomejs/biome`] ??= BIOME_DEV_VERSION
        writeJsonFileAtomic(packageJsonPath, pkg)
      }
    } else {
      log.info(`Removing Biome configuration..`)
      if (fs.existsSync(biomeJsonPath)) fs.unlinkSync(biomeJsonPath)
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, `utf-8`)) as {scripts?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string>; optionalDependencies?: Record<string, string>}
        stripBiomeScripts(pkg)
        removeDependency(pkg, `@biomejs/biome`)
        writeJsonFileAtomic(packageJsonPath, pkg)
      }
    }

    // Task 8: Install
    log.info(`Installing dependencies..`)
    if (skipInstall) {
      log.warn(`Skipping dependencies installation..`)
    } else if (!(await this.installDependencies(projectPath, packageManager))) {
      throw new Error(`Dependencies installation failed`)
    }

    log.info(`Project created successfully!`)
    log.info(`Next steps: ${config.projectPath !== process.cwd() ? `cd ${path.basename(config.projectPath)} && ` : ``}${commands.install} && ${commands.dev}`)
    log.info(`Done..`)
  }

  // ── Entry point ─────────────────────────────────────────────────

  async createProject() {
    this._config = await this.gatherProjectConfig()
    await this.executeProjectGeneration(this._config)
  }
}
