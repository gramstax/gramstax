import { TemplateEngine } from "."
import { readFile, mkdir } from "node:fs/promises"
import { watch, FSWatcher } from "chokidar"
import { basename, join, extname } from "node:path"
import { readdirSync, readFileSync, existsSync, statSync, writeFileSync } from "node:fs"

/** Template file interface for better type safety */
type ICompiledTemplate = {
  message: ReturnType<typeof TemplateEngine.compileMessages>
  keyboard: ReturnType<typeof TemplateEngine.compileKeyboards>
}

/** Template loading options */
type ITemplateOptions = {
  /** Enable file watching for hot reloading (if have templatePath) */
  enableWatch?: boolean
  /** Base path for template files (set null if dont want read template from file) */
  path?: string | undefined | null
  /** Force language params to this value */
  forceLanguage?: string | undefined | null
}

/** Template management system */
export class TemplateManager {
  public _map = new Map<string, ICompiledTemplate>()
  public _engine = TemplateEngine
  public _watcher: FSWatcher | null = null
  public _supportedExtensions = new Set([`.html`])
  public readonly _path: string | null
  public readonly _forceLanguage: string | null
  public readonly _isWatchEnabled: boolean
  public constructor(options: ITemplateOptions = {}) {
    const { enableWatch = false, path = null, forceLanguage = null } = options

    this._path = path
    this._forceLanguage = forceLanguage
    this._isWatchEnabled = enableWatch

    this._validatePath()
    this._initializeWatcher()
    this._loadAllFiles()
  }

  /** Validate and ensure template directory exists. @returns Void */
  public _validatePath(): void {
    try {
      if (this._path === null || !existsSync(this._path)) {
        return
      }

      const stats = statSync(this._path)
      if (!stats.isDirectory()) {
        throw new Error(`Template path is not a directory: ${this._path}`)
      }
    } catch (error) {
      throw new Error(`Failed to validate Template path: ${error}`)
    }
  }

  /** Initialize file system watcher for hot reloading. @returns Void */
  public _initializeWatcher(): void {
    if (this._path === null || !this._isWatchEnabled) {
      return
    }

    this._watcher = watch(this._path, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    })

    this._watcher!.on(`change`, this._handleFileChange.bind(this))
    this._watcher!.on(`add`, this._handleFileAdd.bind(this))
    this._watcher!.on(`unlink`, this._handleFileDelete.bind(this))
    this._watcher!.on(`error`, this._handleWatchError.bind(this))
  }

  /** Handle file change events */
  public async _handleFileChange(filepath: string): Promise<void> {
    const filename = basename(filepath)
    if (this._isValidFile(filename)) {
      await this._loadFile(filename, false)
    }
  }

  /** Handle file add events */
  public async _handleFileAdd(filePath: string): Promise<void> {
    const fileName = basename(filePath)
    if (this._isValidFile(fileName)) {
      await this._loadFile(fileName, false)
    }
  }

  /** Handle file delete events */
  public _handleFileDelete(filePath: string): void {
    const fileName = basename(filePath)
    const fileKey = this._getKey(fileName)
    if (this._map.has(fileKey)) {
      this._map.delete(fileKey)
    }
  }

  /** Handle watcher errors */
  public _handleWatchError(error: any): void {
    // you can overrides
  }

  /** Load all Template files during initialization */
  public _loadAllFiles(): void {
    if (this._path === null || !existsSync(this._path)) {
      return
    }
    const files = readdirSync(this._path, { encoding: `utf8` })
    const validFiles = files.filter((file) => this._isValidFile(file))
    for (const fileName of validFiles) {
      this._loadFile(fileName, true)
    }
  }

  /** Load and compile a single template file */
  public async _loadFile(filename: string, useSync: boolean = true): Promise<void> {
    if (this._path === null) {
      return
    }
    const path = join(this._path, filename)
    const key = this._getKey(filename)
    const raw = useSync ? readFileSync(path, { encoding: `utf8` }) : await readFile(path, { encoding: `utf8` })
    this.compile(key, raw)
  }

  public _isValidFile(filename: string): boolean {
    const extension = extname(filename).toLowerCase()
    return this._supportedExtensions.has(extension)
  }

  public _getKey(filename: string): string {
    return filename.replace(/\.[^/.]+$/, ``)
  }

  public compile(key: string, rawTemplate: string, keepIfExist?: Partial<{ [K in keyof ICompiledTemplate]: boolean }>) {
    const existing = this._map.get(key)
    const compiled = existing || ({} as ICompiledTemplate)
    let updated = false

    if (keepIfExist === undefined || keepIfExist?.message === false || existing?.message === undefined) {
      compiled.message = TemplateEngine.compileMessages(rawTemplate)
      updated = true
    }
    if (keepIfExist === undefined || keepIfExist?.keyboard === false || existing?.keyboard === undefined) {
      compiled.keyboard = TemplateEngine.compileKeyboards(rawTemplate)
      updated = true
    }

    if (updated) {
      this._map.set(key, compiled)
    }
  }

  /**
   * Get compiled message template
   * @param key Template identifier (filename without extension)
   * @param baseId Base id attr from block
   * @param language Target language code
   * @param data Template variables
   * @returns Rendered message string
   */
  public getMessage(key: string, baseId: string = `default`, language: string = `en`, data?: Record<string, any>): string {
    const template = this._map.get(key)
    const func = template?.message?.[baseId]?.[this._forceLanguage || language]
    if (!func) {
      return ``
    }

    try {
      return func(data)
    } catch (error) {
      return ``
    }
  }

  /**
   * Get compiled keyboard template
   * @param key Template identifier (filename without extension)
   * @param baseId Base id attr from block
   * @param language Target language code
   * @param data Template variables
   * @returns Array of rendered button labels
   */
  public getKeyboard(key: string, baseId: string = `default`, language: string = `en`, display: `inline` | `default` = `inline`, data?: Record<string, any>): string[] {
    const template = this._map.get(key)
    const func = template?.keyboard?.[baseId]?.[this._forceLanguage || language]?.[display]
    if (!func) {
      return []
    }

    try {
      return func(data)
    } catch (error) {
      return []
    }
  }

  /**
   * Update message template in memory
   * @param key Template identifier (filename without extension)
   * @param rawTemplate Raw template string
   */
  public setMessage(key: string, rawTemplate: string): void {
    this.compile(key, rawTemplate, { keyboard: true })
  }

  /**
   * Update keyboard template in memory
   * @param key Template identifier (filename without extension)
   * @param rawTemplate Raw template string
   */
  public setKeyboard(key: string, rawTemplate: string): void {
    this.compile(key, rawTemplate, { message: true })
  }

  /**
   * Write template to file and update cache
   * @param filename Target filename (with extension)
   * @param rawTemplate Template to write
   * @returns Promise that resolves when file is written
   */
  public async write(filename: string, rawTemplate: string): Promise<void> {
    if (this._path === null) {
      return
    }
    const filePath = join(this._path, filename)
    await mkdir(this._path, { recursive: true })
    writeFileSync(filePath, rawTemplate, { encoding: `utf8` })
    await this._loadFile(filename, false)
  }

  /**
   * Get list of available template
   * @returns Array of template names
   */
  public getAvailable(): string[] {
    return Array.from(this._map.keys())
  }

  /**
   * Check if template exists
   * @param key Template identifier
   * @returns True if template exists
   */
  public has(key: string): boolean {
    return this._map.has(key)
  }

  /**
   * Get cache statistics
   * @returns Object with cache information
   */
  public getCacheStats(): { templateCount: number; totalSize: number } {
    return {
      templateCount: this._map.size,
      totalSize: JSON.stringify(this._map.entries().toArray(), (_, value) => {
        return typeof value === `function` ? value.toString() : value
      }).length
    }
  }

  /**
   * Cleanup resources and close watchers
   * @returns Promise void
   */
  public async destroy(): Promise<void> {
    if (this._watcher) {
      await this._watcher.close()
    }
    this._map.clear()
  }
}
