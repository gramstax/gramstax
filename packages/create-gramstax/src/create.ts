import * as fs from "fs"
import * as path from "path"
import { log } from "./utils/logger"
import { spawn } from "child_process"
import enquirer from "enquirer"

type Runtime = `bun` | `node`
type PackageManager = `bun` | `npm` | `pnpm` | `yarn`
type ProjectConfig = {
  projectName: string
  projectPath: string
  packageManager: PackageManager
  runtime: Runtime
  setupEslint: boolean
}

export class Create {
  private config: ProjectConfig | undefined

  public constructor(private projectDirectory?: string, private version?: string) {
    // Constructor hanya menerima parameter, tidak melakukan execution
  }

  public printBanner() {
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
    console.log(banner)
  }

  private getPackageManagerCommands(packageManager: PackageManager) {
    const commands = {
      bun: {
        install: `bun install`,
        dev: `bun dev`,
        start: `bun start`,
        "pm2:start": `bun run pm2:start`,
        "pm2:stop": `bun run pm2:stop`,
        "pm2:restart": `bun run pm2:restart`,
        "pm2:delete": `bun run pm2:delete`,
        "pm2:logs": `bun run pm2:logs`,
        "pm2:monit": `bun run pm2:monit`
      },
      npm: {
        install: `npm install`,
        dev: `npm run dev`,
        start: `npm start`,
        "pm2:start": `npm run pm2:start`,
        "pm2:stop": `npm run pm2:stop`,
        "pm2:restart": `npm run pm2:restart`,
        "pm2:delete": `npm run pm2:delete`,
        "pm2:logs": `npm run pm2:logs`,
        "pm2:monit": `npm run pm2:monit`
      },
      pnpm: {
        install: `pnpm install`,
        dev: `pnpm dev`,
        start: `pnpm start`,
        "pm2:start": `pnpm pm2:start`,
        "pm2:stop": `pnpm pm2:stop`,
        "pm2:restart": `pnpm pm2:restart`,
        "pm2:delete": `pnpm pm2:delete`,
        "pm2:logs": `pnpm pm2:logs`,
        "pm2:monit": `pnpm pm2:monit`
      },
      yarn: {
        install: `yarn install`,
        dev: `yarn dev`,
        start: `yarn start`,
        "pm2:start": `yarn pm2:start`,
        "pm2:stop": `yarn pm2:stop`,
        "pm2:restart": `yarn pm2:restart`,
        "pm2:delete": `yarn pm2:delete`,
        "pm2:logs": `yarn pm2:logs`,
        "pm2:monit": `yarn pm2:monit`
      }
    }
    return commands[packageManager]
  }

  /**
   * Recursively copy directory structure
   */
  private copyDirectorySync(source: string, destination: string, variables: Record<string, string> = {}) {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true })
    }

    // Read all items in source directory
    const items = fs.readdirSync(source, { withFileTypes: true })

    for (const item of items) {
      const sourcePath = path.join(source, item.name)
      const destPath = path.join(destination, item.name)

      if (item.isDirectory()) {
        // Recursively copy subdirectories
        this.copyDirectorySync(sourcePath, destPath, variables)
      } else if (item.isFile()) {
        // Copy file and replace variables if needed
        let content = fs.readFileSync(sourcePath, `utf-8`)

        // Replace template variables in content
        content = this.replaceTemplateVariables(content, variables)

        fs.writeFileSync(destPath, content)
      }
    }
  }

  /**
   * Replace template variables in content
   */
  private replaceTemplateVariables(content: string, variables: Record<string, string>): string {
    let result = content
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, `g`), value)
    }
    return result
  }

  private async promptForProjectName(): Promise<string> {
    const response = await enquirer.prompt<{ projectName: string }>({
      type: `input`,
      name: `projectName`,
      message: `What is your project named?`,
      initial: ``,
      validate: (value: string) => {
        if (value === ``) {
          return true
        }

        if (!/^[a-z0-9-_]+$/i.test(value)) {
          return `Project name can only contain letters, numbers, hyphens, and underscores`
        }
        return true
      }
    })

    return response.projectName
  }

  private async promptForConfiguration(): Promise<{ packageManager: PackageManager; runtime: Runtime; eslint: boolean }> {
    const questions: any[] = []

    // Package manager selection
    questions.push({
      type: `select`,
      name: `packageManager`,
      message: `Which package manager would you like to use?`,
      choices: [
        { name: `bun`, message: `Bun (recommended)`, value: `bun` },
        { name: `npm`, message: `npm`, value: `npm` },
        { name: `pnpm`, message: `pnpm`, value: `pnpm` },
        { name: `yarn`, message: `Yarn`, value: `yarn` }
      ],
      initial: 0
    })

    // Runtime selection
    questions.push({
      type: `select`,
      name: `runtime`,
      message: `Which runtime would you like to use?`,
      choices: [
        { name: `bun`, message: `Bun (recommended)`, value: `bun` },
        { name: `node`, message: `Node.js`, value: `node` }
      ],
      initial: 0
    })

    // ESLint
    questions.push({
      type: `confirm`,
      name: `eslint`,
      message: `Would you like to use ESLint?`,
      initial: true
    })

    const answers = await enquirer.prompt<{
      packageManager?: PackageManager
      runtime: Runtime
      eslint?: boolean
    }>(questions)

    return {
      packageManager: answers.packageManager as any,
      runtime: answers.runtime,
      eslint: answers.eslint as boolean
    }
  }

  private async installDependencies(projectPath: string, packageManager: PackageManager): Promise<boolean> {
    return await new Promise((resolve, reject) => {
      const installCommand = packageManager
      const installArgs = [`install`]
      const installProcess = spawn(installCommand, installArgs, {
        cwd: projectPath,
        stdio: `inherit`,
        shell: true
      })

      installProcess.on(`close`, (code) => {
        if (code === 0) {
          resolve(true)
        } else {
          log.fail(`Dependencies installation failed`)
          resolve(false)
        }
      })

      installProcess.on(`error`, (error) => {
        log.fail(`Dependencies installation failed: ${error.message}`)
        resolve(false)
      })
    })
  }

  /**
   * Step 1: Gather all project configuration through prompts
   * NO EXECUTION - hanya mengumpulkan data dan validasi ringan
   */
  private async gatherProjectConfig(): Promise<ProjectConfig> {
    // Display ASCII art banner
    this.printBanner()

    // ========== PHASE 1: GET PROJECT NAME ==========
    let projectName = this.projectDirectory
    let projectPath: string
    let useCurrentDir = false

    if (!projectName) {
      // PROMPT untuk project name
      projectName = await this.promptForProjectName()
      if (projectName === ``) {
        // Empty name means use current directory
        projectName = path.basename(process.cwd())
        projectPath = process.cwd()
        useCurrentDir = true
      } else {
        projectPath = path.resolve(process.cwd(), projectName)
        useCurrentDir = false
      }
    } else {
      projectPath = path.resolve(process.cwd(), projectName)
      useCurrentDir = false
    }

    // PROMPT untuk configuration
    const config = await this.promptForConfiguration()
    const packageManager = config.packageManager
    const runtime = config.runtime
    const setupEslint = config.eslint

    // ========== SEMUA PROMPT SELESAI, SEKARANG VALIDASI ==========
    log.info(`Create-gramstax v${this.version}`)
    log.info(`Project: ${projectName}`)
    log.info(`Location: ${projectPath}`)
    log.info(`Package Manager: ${packageManager}`)
    log.info(`Runtime: ${runtime}`)
    log.info(`ESLint: ${setupEslint ? `Yes` : `No`}`)

    // Validasi setelah semua prompt selesai
    if (useCurrentDir) {
      // Check if current directory is empty
      const files = fs.readdirSync(projectPath)
      if (files.length > 0) {
        log.error(`Current directory is not empty!`)
        process.exit(1)
      }
    } else {
      // Check if directory already exists
      if (fs.existsSync(projectPath)) {
        log.error(`Directory "${projectName}" already exists!`)
        process.exit(1)
      }
    }

    return {
      projectName,
      projectPath,
      packageManager,
      runtime,
      setupEslint
    }
  }

  /**
   * Step 2: Execute project generation based on gathered config
   */
  private async executeProjectGeneration(config: ProjectConfig): Promise<void> {
    const { projectName, projectPath, packageManager, runtime, setupEslint } = config

    // Task 1: Create project directory
    log.info(`Creating project directory..`)
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true })
    }

    // Task 2: Copy template files
    log.info(`Copying template files..`)
    const templatesPath = path.join(__dirname, `templates`)
    const commands = this.getPackageManagerCommands(packageManager)

    const variables = {
      projectName,
      installCmd: commands.install,
      runDevCmd: commands.dev,
      runStartCmd: commands.start,
      runPm2StartCmd: commands[`pm2:start`],
      runPm2StopCmd: commands[`pm2:stop`],
      runPm2RestartCmd: commands[`pm2:restart`],
      runPm2DeleteCmd: commands[`pm2:delete`],
      runPm2LogsCmd: commands[`pm2:logs`],
      runPm2MonitCmd: commands[`pm2:monit`]
    }

    this.copyDirectorySync(templatesPath, projectPath, variables)

    // Task 3: Create logs directory
    log.info(`Creating logs directory..`)
    fs.mkdirSync(path.join(projectPath, `logs`), { recursive: true })
    fs.writeFileSync(path.join(projectPath, `logs/.gitkeep`), ``)

    // Task 4: Create .env.example
    const envPath = path.join(projectPath, `.env`)
    const envExamplePath = path.join(projectPath, `.env.example`)
    if (fs.existsSync(envExamplePath)) {
      log.info(`Creating .env file..`)
      fs.renameSync(envExamplePath, envPath)
    }

    // Task 5: Remove bunfig.toml if runtime is NOT bun
    if (runtime !== `bun`) {
      log.info(`Removing bunfig.toml for Node.js runtime..`)
      const bunfigPath = path.join(projectPath, `bunfig.toml`)
      if (fs.existsSync(bunfigPath)) {
        fs.unlinkSync(bunfigPath)
      }
    }

    // Task 6: Rename tsconfig.json
    const tsconfigPathOld = path.join(projectPath, `tsconfig.json.template`)
    const tsconfigPathNew = path.join(projectPath, `tsconfig.json`)
    fs.renameSync(tsconfigPathOld, tsconfigPathNew)

    // Task 6: Install dependencies
    log.info(`Installing dependencies..`)
    if (!(await this.installDependencies(projectPath, packageManager))) {
      log.fail(`Project created failed!`)
      return process.exit()
    }

    // Task 7: Setup ESLint if requested
    if (setupEslint) {
      log.info(`Setting up ESLint..`)
      await this.setupEslintConfig(projectPath, packageManager)
    }

    // Final success message
    log.info(`Project created successfully!`)
    log.info(`Next steps: ${config.projectPath !== process.cwd() ? `cd ${projectName} && ` : ` `}${commands.install} && ${commands.dev}`)
    log.info(`For production: ${commands[`pm2:start`]}`)
    log.info(`Done..`)
  }

  private async setupEslintConfig(projectPath: string, packageManager: PackageManager): Promise<void> {
    return new Promise((resolve) => {
      const initProcess = spawn(`npm`, [`init`, `@eslint/config@latest`], {
        cwd: projectPath,
        stdio: `inherit`,
        shell: true
      })

      initProcess.on(`close`, (code) => {
        if (code === 0) {
          resolve()
        } else {
          log.fail(`ESLint setup failed. You can set it up later with: npm init @eslint/config`)
          resolve()
        }
      })

      initProcess.on(`error`, (error) => {
        log.fail(`ESLint setup failed: ${error.message}`)
        log.info(`You can set it up later with: npm init @eslint/config`)
        resolve()
      })
    })
  }

  /**
   * Main public method: Prompt first, then execute
   */
  public async createProject() {
    try {
      // Step 1: Gather all configuration through prompts
      this.config = await this.gatherProjectConfig()

      // Step 2: Execute project generation with the gathered config
      await this.executeProjectGeneration(this.config)
    } catch (error) {
      if (error instanceof Error) {
        log.error(`Failed to create project: ${error.message}`)
      } else {
        log.error(`Failed to create project: ${String(error)}`)
      }
      process.exit(1)
    }
  }
}
