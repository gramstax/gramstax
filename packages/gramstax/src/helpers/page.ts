import type { Ctx } from "../core"

export class HelperPage {
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

  public static getPageSync(path: string, redactedTemplate = true) {
    const mod = require(path) // eslint-disable-line
    return this._getPage(mod, path, redactedTemplate)
  }

  public static async getPage(path: string, redactedTemplate = true) {
    const mod = await import(`${path}?t=${Date.now()}`)
    return this._getPage(mod, path, redactedTemplate)
  }
}
