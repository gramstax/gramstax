import {LogHe} from "~/helpers/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static dynamic = `d`
}

class Helper {
  static kb(ctx) {
    const bi = Base.dynamic
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    return kb
  }
}

class Alert {
  static async showError(ctx, funcName, error, edit = true) {
    LogHe.errorMake(error, ctx.constructorName, funcName)

    await ctx.clearSession()
    const bi = Base.dynamic
    const kb = Helper.kb(ctx)
    const da = {isNotFound: false}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async showErrorInputNotFound(ctx) {
    const bi = Base.dynamic
    const kb = Helper.kb(ctx)
    const da = {isNotFound: true}
    await ctx.reply(kb, da, bi)
  }
}

export class GeneralStatusPage extends PageBase {
  constructorName;

  constructor(p) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  async showError(...args = []) {
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
