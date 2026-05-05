import {LogHe} from "~/helpers/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static dynamic = `d`
}

class Helper {
  static async built(ctx: GeneralStatusPage, isNotFound: boolean, edit = true) {
    const bi = Base.dynamic
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    const da = {isNotFound}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }
}

class Alert {
  static async showError(ctx: GeneralStatusPage, funcName: string, error: any, edit = true) {
    LogHe.errorMake(error, ctx.constructorName, funcName)

    await ctx.clearSession()
    await Helper.built(ctx, false, edit)
  }

  static async showErrorInputNotFound(ctx: GeneralStatusPage) {
    await Helper.built(ctx, true, false)
  }
}

export class GeneralStatusPage extends PageBase {
  constructorName?: string

  constructor(p: any) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  async showError(...args: Parameters<typeof Alert.showError> extends [any, ...infer R] ? R : []) {
    await Alert.showError(this, ...args)
  }

  async showErrorInputNotFound() {
    await Alert.showErrorInputNotFound(this)
  }

  static template = `
    <base id="${Base.dynamic}">
      ${this.kbk.home()}
      <message>
        {~isNotFound ? "🔎 Route not found" : "❌ Something went wrong"~}

        {~isNotFound ? "Use Home to return to the main menu and try a different action." : "Please try again in a moment, or return Home if the issue persists."~}
      </message>
    </base>
  `
}
