import {join} from "node:path"
import {existsSync, readdirSync} from "node:fs"
import type {Ctx} from "~/core/ctx"
import {createRequire} from "node:module"

export class PageManager {
  static _getFile(mod: Record<any, any>, path: string, positionModule = 0) {
    const exp = Object.values(mod)
    const Page = exp[positionModule] as typeof Ctx // like StartPage. not have default export
    if (Page === undefined) {
      throw new Error(`File ${path} must have export (not default) class page`)
    }
    return Page
  }

  static getFilePath() {
    return join(process.cwd(), `src`, `pages`)
  }

  static getFileSync(path?: string, positionModule = 0) {
    if (!path) {
      path = this.getFilePath()
    }
    const mod = createRequire(path) as any
    const def = mod(path)
    return this._getFile(def, path, positionModule)
  }

  static async getFile(path?: string, positionModule = 0) {
    if (!path) {
      path = this.getFilePath()
    }
    const mod = (await import(`${path}?t=${Date.now()}`)) as Record<any, any>
    return this._getFile(mod, path, positionModule)
  }

  static getFileManySync(path?: string, positionModule = 0) {
    if (!path) {
      path = this.getFilePath()
    }
    if (!existsSync(path)) {
      throw new Error(`Directory ${path} is not found, please make it manually`)
    }

    const files = readdirSync(path)
    return files.map((file) => {
      const pathFile = join(path, file)
      return {
        path: pathFile,
        page: this.getFileSync(pathFile, positionModule)
      }
    })
  }

  static clearCacheRequire(path?: string) {
    if (!path) {
      path = this.getFilePath()
    }
    if (!existsSync(path)) {
      throw new Error(`Directory ${path} is not found, please make it manually`)
    }

    const files = readdirSync(path)
    files.forEach((file) => {
      const pathFile = join(path, file)
      delete require.cache[require.resolve(pathFile)]
    })
    return true
  }
}
