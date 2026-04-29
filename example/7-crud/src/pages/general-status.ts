import {LogHe} from "~/helpers/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Helper {
  static buildHomeKeyboard(ctx: GeneralStatusPage) {
    return ctx.inlineKeyboardT([StartPage])
  }
}

class Alert {
  static async error(ctx: GeneralStatusPage, funcName: string, error: any, edit = true) {
    LogHe.errorMake(error, ctx.constructorName, funcName)

    await ctx.clearSession()
    const kb = Helper.buildHomeKeyboard(ctx)
    const da = {isNotFound: false}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }

  static async errorInputNotFound(ctx: GeneralStatusPage) {
    const kb = Helper.buildHomeKeyboard(ctx)
    const da = {isNotFound: true}
    await ctx.reply(kb, da)
  }
}

export class GeneralStatusPage extends PageBase {
  constructorName?: string

  constructor(p: any) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  async error(...args: Parameters<typeof Alert.error> extends [any, ...infer R] ? R : []) {
    await Alert.error(this, ...args)
  }

  async errorInputNotFound() {
    await Alert.errorInputNotFound(this)
  }

  static template = `
    <base>
      ${this.kbk.home()}
      <message>
        {~isNotFound ? "🔎 Route not found" : "❌ Something went wrong"~}

        {~isNotFound ? "Use Home to return to the main menu and try a different action." : "Please try again in a moment, or return Home if the issue persists."~}
      </message>
    </base>
  `
}
