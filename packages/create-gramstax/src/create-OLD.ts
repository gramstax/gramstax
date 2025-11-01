import * as fs from "fs"
import * as path from "path"
import { log } from "./utils/logger"
import { spawn } from "child_process"
import enquirer from "enquirer"

type CreateOptions = {
  yes?: boolean
  useBun?: boolean
  useNpm?: boolean
  usePnpm?: boolean
  useYarn?: boolean
  eslint?: boolean
}

type PackageManager = `bun` | `npm` | `pnpm` | `yarn`
type Runtime = `bun` | `node`

/**
 * Recursively copy directory structure
 */
function copyDirectorySync(source: string, destination: string, variables: Record<string, string> = {}) {
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
      copyDirectorySync(sourcePath, destPath, variables)
    } else if (item.isFile()) {
      // Copy file and replace variables if needed
      let content = fs.readFileSync(sourcePath, `utf-8`)

      // Replace template variables in content
      content = replaceTemplateVariables(content, variables)

      fs.writeFileSync(destPath, content)
    }
  }
}

/**
 * Replace template variables in content
 */
function replaceTemplateVariables(content: string, variables: Record<string, string>): string {
  let result = content
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, `g`), value)
  }
  return result
}

/**
 * Get package manager commands
 */
function getPackageManagerCommands(packageManager: PackageManager) {
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

export async function createProject(projectDirectory?: string, options?: CreateOptions) {
  // Display ASCII art banner
  printBanner()

  // Get project name - if not provided, prompt or use current directory
  let projectName = projectDirectory
  let projectPath: string

  if (!projectName) {
    if (options?.yes) {
      // Use current directory name like npm init
      projectName = path.basename(process.cwd())
      projectPath = process.cwd()

      // Check if current directory is empty
      const files = fs.readdirSync(projectPath)
      if (files.length > 0) {
        log.error(`Current directory is not empty!`)
        process.exit(1)
      }
    } else {
      projectName = await promptForProjectName()
      projectPath = path.resolve(process.cwd(), projectName)

      // Check if directory already exists
      if (fs.existsSync(projectPath) && projectName != ``) {
        log.error(`Directory "${projectName}" already exists!`)
        process.exit(1)
      }

      if (projectName != ``) {
        // Create project directory
        fs.mkdirSync(projectPath, { recursive: true })
      }
    }
  } else {
    projectPath = path.resolve(process.cwd(), projectName)

    // Check if directory already exists
    if (fs.existsSync(projectPath)) {
      log.error(`Directory "${projectName}" already exists!`)
      process.exit(1)
    }

    // Create project directory
    fs.mkdirSync(projectPath, { recursive: true })
  }

  log.info(`Creating project: ${path.basename(projectPath)}`)
  log.info(`Location: ${projectPath}`)

  // Prompt for configuration if not in --yes mode
  let packageManager: PackageManager
  let runtime: Runtime
  let setupEslint: boolean

  if (options?.yes) {
    packageManager = detectPackageManager(options)
    runtime = packageManager === `bun` ? `bun` : `node`
    setupEslint = false

    log.info(`Using defaults - Package Manager: ${packageManager}, Runtime: ${runtime}, ESLint: No`)
  } else {
    const config = await promptForConfiguration(options)
    packageManager = config.packageManager
    runtime = config.runtime
    setupEslint = config.eslint

    log.info(`Configuration - Package Manager: ${packageManager}, Runtime: ${runtime}, ESLint: ${setupEslint ? `Yes` : `No`}`)
  }

  // Generate project structure
  log.info(`Generating project structure...`)
  await generateProjectStructure(projectPath, projectName, packageManager, runtime)

  // Setup ESLint if requested
  if (setupEslint) {
    log.info(`Setting up ESLint...`)
    await setupEslintConfig(projectPath, packageManager)
  }

  const commands = getPackageManagerCommands(packageManager)

  log.success(`Project created successfully!`)
  log.info(``)
  log.info(`Next steps:`)
  if (projectDirectory) {
    log.info(`  cd ${projectName}`)
  }
  log.info(`  ${commands.install}`)
  log.info(`  ${commands.dev}`)
  log.info(``)
  log.info(`For production:`)
  log.info(`  ${commands[`pm2:start`]}`)
}

function printBanner() {
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

async function promptForProjectName(): Promise<string> {
  const response = await enquirer.prompt<{ projectName: string }>({
    type: `input`,
    name: `projectName`,
    message: `What is your project named?`,
    initial: ``,
    validate: (value: string) => {
      if (value == ``) {
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

async function promptForConfiguration(options?: CreateOptions): Promise<{
  packageManager: PackageManager
  runtime: Runtime
  eslint: boolean
}> {
  const questions: any[] = []

  // Package manager selection
  if (!options?.useBun && !options?.useNpm && !options?.usePnpm && !options?.useYarn) {
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
  }

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
  if (options?.eslint === undefined) {
    questions.push({
      type: `confirm`,
      name: `eslint`,
      message: `Would you like to use ESLint?`,
      initial: true
    })
  }

  const answers = await enquirer.prompt<{
    packageManager?: PackageManager
    runtime: Runtime
    eslint?: boolean
  }>(questions)

  return {
    packageManager: answers.packageManager || detectPackageManager(options),
    runtime: answers.runtime,
    eslint: answers.eslint !== undefined ? answers.eslint : options?.eslint || false
  }
}

function detectPackageManager(options?: CreateOptions): PackageManager {
  if (options?.useBun) return `bun`
  if (options?.useNpm) return `npm`
  if (options?.usePnpm) return `pnpm`
  if (options?.useYarn) return `yarn`

  // Try to detect from environment
  const userAgent = process.env.npm_config_user_agent || ``
  if (userAgent.includes(`bun`)) return `bun`
  if (userAgent.includes(`pnpm`)) return `pnpm`
  if (userAgent.includes(`yarn`)) return `yarn`

  // Default to bun
  return `bun`
}

async function generateProjectStructure(projectPath: string, projectName: string, packageManager: PackageManager, runtime: Runtime) {
  log.info(`📁 Creating project structure...`)

  const templatesPath = path.join(__dirname, `templates`)
  const commands = getPackageManagerCommands(packageManager)

  // Prepare template variables
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

  log.info(`📝 Copying template files...`)

  // Copy entire template structure recursively
  copyDirectorySync(templatesPath, projectPath, variables)

  // Create logs directory
  fs.mkdirSync(path.join(projectPath, `logs`), { recursive: true })
  fs.writeFileSync(path.join(projectPath, `logs/.gitkeep`), ``)

  // Create .env.example as copy of .env
  const envPath = path.join(projectPath, `.env`)
  const envExamplePath = path.join(projectPath, `.env.example`)
  if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, envExamplePath)
  }

  // Remove bunfig.toml if runtime is NOT bun
  if (runtime !== `bun`) {
    const bunfigPath = path.join(projectPath, `bunfig.toml`)
    if (fs.existsSync(bunfigPath)) {
      fs.unlinkSync(bunfigPath)
    }
  }

  log.success(`✅ All files generated!`)
}

async function setupEslintConfig(projectPath: string, packageManager: PackageManager): Promise<void> {
  log.info(``)
  log.info(`🔍 Setting up ESLint...`)

  return new Promise((resolve, reject) => {
    // Use npm init @eslint/config with --yes flag for default configuration
    const initProcess = spawn(`npm`, [`init`, `@eslint/config@latest`, `--`, `--yes`], {
      cwd: projectPath,
      stdio: `inherit`,
      shell: true
    })

    initProcess.on(`close`, (code) => {
      if (code === 0) {
        log.success(`✅ ESLint configured successfully!`)
        resolve()
      } else {
        log.warn(`⚠️  ESLint setup failed. You can set it up later with: npm init @eslint/config`)
        resolve() // Don't fail the whole process
      }
    })

    initProcess.on(`error`, (error) => {
      log.warn(`⚠️  ESLint setup failed: ${error.message}`)
      log.info(`You can set it up later with: npm init @eslint/config`)
      resolve() // Don't fail the whole process
    })
  })
}

export default class {
  public runtime: Runtime | undefined
  public projectPath: string | undefined
  public projectName: string | undefined
  public packageManager: PackageManager | undefined
  public constructor() {
    //
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

  public detectPackageManager(options?: CreateOptions): PackageManager {
    if (options?.useBun) return (this.packageManager = `bun`)
    if (options?.useNpm) return (this.packageManager = `npm`)
    if (options?.usePnpm) return (this.packageManager = `pnpm`)
    if (options?.useYarn) return (this.packageManager = `yarn`)

    // Try to detect from environment
    const userAgent = process.env.npm_config_user_agent || ``
    if (userAgent.includes(`bun`)) return (this.packageManager = `bun`)
    if (userAgent.includes(`pnpm`)) return (this.packageManager = `pnpm`)
    if (userAgent.includes(`yarn`)) return (this.packageManager = `yarn`)

    // Default to bun
    return (this.packageManager = `bun`)
  }

  /**
   * Recursively copy directory structure
   */
  public copyDirectorySync(source: string, destination: string, variables: Record<string, string> = {}) {
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
        copyDirectorySync(sourcePath, destPath, variables)
      } else if (item.isFile()) {
        // Copy file and replace variables if needed
        let content = fs.readFileSync(sourcePath, `utf-8`)

        // Replace template variables in content
        content = replaceTemplateVariables(content, variables)

        fs.writeFileSync(destPath, content)
      }
    }
  }

  /**
   * Replace template variables in content
   */
  public replaceTemplateVariables(content: string, variables: Record<string, string>): string {
    let result = content
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, `g`), value)
    }
    return result
  }

  /**
   * Get package manager commands
   */
  public getPackageManagerCommands(packageManager: PackageManager) {
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

  public async promptForProjectName(): Promise<string> {
    const response = await enquirer.prompt<{ projectName: string }>({
      type: `input`,
      name: `projectName`,
      message: `What is your project named?`,
      initial: ``,
      validate: (value: string) => {
        if (value == ``) {
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

  public async promptForConfiguration(options?: CreateOptions): Promise<{
    packageManager: PackageManager
    runtime: Runtime
    eslint: boolean
  }> {
    const questions: any[] = []

    // Package manager selection
    if (!options?.useBun && !options?.useNpm && !options?.usePnpm && !options?.useYarn) {
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
    }

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
    if (options?.eslint === undefined) {
      questions.push({
        type: `confirm`,
        name: `eslint`,
        message: `Would you like to use ESLint?`,
        initial: true
      })
    }

    const answers = await enquirer.prompt<{
      packageManager?: PackageManager
      runtime: Runtime
      eslint?: boolean
    }>(questions)

    return {
      packageManager: answers.packageManager || detectPackageManager(options),
      runtime: answers.runtime,
      eslint: answers.eslint !== undefined ? answers.eslint : options?.eslint || false
    }
  }

  public async generateProjectStructure(projectPath: string, projectName: string, packageManager: PackageManager, runtime: Runtime) {
    log.info(`📁 Creating project structure...`)

    const templatesPath = path.join(__dirname, `templates`)
    const commands = getPackageManagerCommands(packageManager)

    // Prepare template variables
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

    log.info(`📝 Copying template files...`)

    // Copy entire template structure recursively
    copyDirectorySync(templatesPath, projectPath, variables)

    // Create logs directory
    fs.mkdirSync(path.join(projectPath, `logs`), { recursive: true })
    fs.writeFileSync(path.join(projectPath, `logs/.gitkeep`), ``)

    // Create .env.example as copy of .env
    const envPath = path.join(projectPath, `.env`)
    const envExamplePath = path.join(projectPath, `.env.example`)
    if (fs.existsSync(envPath)) {
      fs.copyFileSync(envPath, envExamplePath)
    }

    // Remove bunfig.toml if runtime is NOT bun
    if (runtime !== `bun`) {
      const bunfigPath = path.join(projectPath, `bunfig.toml`)
      if (fs.existsSync(bunfigPath)) {
        fs.unlinkSync(bunfigPath)
      }
    }

    log.success(`✅ All files generated!`)
  }

  public async setupEslintConfig(projectPath: string, packageManager: PackageManager): Promise<void> {
    log.info(``)
    log.info(`🔍 Setting up ESLint...`)

    return new Promise((resolve, reject) => {
      // Use npm init @eslint/config with --yes flag for default configuration
      const initProcess = spawn(`npm`, [`init`, `@eslint/config@latest`, `--`, `--yes`], {
        cwd: projectPath,
        stdio: `inherit`,
        shell: true
      })

      initProcess.on(`close`, (code) => {
        if (code === 0) {
          log.success(`✅ ESLint configured successfully!`)
          resolve()
        } else {
          log.warn(`⚠️  ESLint setup failed. You can set it up later with: npm init @eslint/config`)
          resolve() // Don't fail the whole process
        }
      })

      initProcess.on(`error`, (error) => {
        log.warn(`⚠️  ESLint setup failed: ${error.message}`)
        log.info(`You can set it up later with: npm init @eslint/config`)
        resolve() // Don't fail the whole process
      })
    })
  }

  public async createProject(projectDirectory?: string, options?: CreateOptions) {
    // Display ASCII art banner
    printBanner()

    // Get project name - if not provided, prompt or use current directory
    let projectName = projectDirectory
    let projectPath: string

    if (!projectName) {
      if (options?.yes) {
        // Use current directory name like npm init
        projectName = path.basename(process.cwd())
        projectPath = process.cwd()

        // Check if current directory is empty
        const files = fs.readdirSync(projectPath)
        if (files.length > 0) {
          log.error(`Current directory is not empty!`)
          process.exit(1)
        }
      } else {
        projectName = await promptForProjectName()
        projectPath = path.resolve(process.cwd(), projectName)

        // Check if directory already exists
        if (fs.existsSync(projectPath) && projectName != ``) {
          log.error(`Directory "${projectName}" already exists!`)
          process.exit(1)
        }

        if (projectName != ``) {
          // Create project directory
          fs.mkdirSync(projectPath, { recursive: true })
        }
      }
    } else {
      projectPath = path.resolve(process.cwd(), projectName)

      // Check if directory already exists
      if (fs.existsSync(projectPath)) {
        log.error(`Directory "${projectName}" already exists!`)
        process.exit(1)
      }

      // Create project directory
      fs.mkdirSync(projectPath, { recursive: true })
    }

    log.info(`Creating project: ${path.basename(projectPath)}`)
    log.info(`Location: ${projectPath}`)

    // Prompt for configuration if not in --yes mode
    let packageManager: PackageManager
    let runtime: Runtime
    let setupEslint: boolean

    if (options?.yes) {
      packageManager = this.detectPackageManager(options)
      runtime = packageManager === `bun` ? `bun` : `node`
      setupEslint = false

      log.info(`Using defaults - Package Manager: ${packageManager}, Runtime: ${runtime}, ESLint: No`)
    } else {
      const config = await promptForConfiguration(options)
      packageManager = config.packageManager
      runtime = config.runtime
      setupEslint = config.eslint

      log.info(`Configuration - Package Manager: ${packageManager}, Runtime: ${runtime}, ESLint: ${setupEslint ? `Yes` : `No`}`)
    }

    // Generate project structure
    log.info(`Generating project structure...`)
    await generateProjectStructure(projectPath, projectName, packageManager, runtime)

    // Setup ESLint if requested
    if (setupEslint) {
      log.info(`Setting up ESLint...`)
      await setupEslintConfig(projectPath, packageManager)
    }

    const commands = getPackageManagerCommands(packageManager)

    log.success(`Project created successfully!`)
    log.info(``)
    log.info(`Next steps:`)
    if (projectDirectory) {
      log.info(`  cd ${projectName}`)
    }
    log.info(`  ${commands.install}`)
    log.info(`  ${commands.dev}`)
    log.info(``)
    log.info(`For production:`)
    log.info(`  ${commands[`pm2:start`]}`)
  }
}
