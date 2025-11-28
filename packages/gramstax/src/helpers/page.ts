import { join } from "node:path"
import { existsSync, readdirSync } from "node:fs"
import type { Ctx } from "../core"

export class HelperPage {
  public static getPath() {
    return join(process.cwd(), `src`, `pages`)
  }

  public static _getPage(mod: any, path: string, redactedTemplate = true) {
    const exp = Object.values(mod)
    const Page = exp[0] as typeof Ctx // like StartPage. not have default export
    if (Page === undefined) {
      throw new Error(`File ${path} must have export (not default) class page`)
    }
    if (redactedTemplate === true) {
      Page.template = undefined
    }
    return Page
  }

  public static getPageSync(path?: string, redactedTemplate = true) {
    if (!path) {
      path = this.getPath()
    }
    const mod = require(path) // eslint-disable-line
    return this._getPage(mod, path, redactedTemplate)
  }

  public static async getPage(path?: string, redactedTemplate = true) {
    if (!path) {
      path = this.getPath()
    }
    const mod = await import(`${path}?t=${Date.now()}`)
    return this._getPage(mod, path, redactedTemplate)
  }

  public static getPagesSync(path?: string, redactedTemplate = true) {
    if (!path) {
      path = this.getPath()
    }
    if (!existsSync(path)) {
      throw new Error(`Directory ${path} is not found, please make it manually`)
    }

    const files = readdirSync(path)
    return files.map((file) => {
      const pathFile = join(path, file)
      return {
        path: pathFile,
        page: this.getPageSync(pathFile, redactedTemplate)
      }
    })
  }
}
