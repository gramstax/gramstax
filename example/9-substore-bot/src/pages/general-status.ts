import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static error = `e`
  static notFound = `nf`
}

class Helper {
  static kb(ctx: GeneralStatusPage, bi?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, bi)
  }
}

class Main {
  static async showError(ctx: GeneralStatusPage, code: string, error: unknown, isEdit = false) {
    const bi = Base.error
    const kb = Helper.kb(ctx, bi)
    const da = {code, error: String(error)}
    if (isEdit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async showErrorInputNotFound(ctx: GeneralStatusPage) {
    const bi = Base.notFound
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.reply(kb, da, bi)
  }
}

export class GeneralStatusPage extends PageBase {
  async showError(code: string, error: unknown, isEdit = false) {
    await Main.showError(this, code, error, isEdit)
  }

  async showErrorInputNotFound() {
    await Main.showErrorInputNotFound(this)
  }

  static template = `
    <g-base id="${Base.error}">
      ${this.kbk.home()}
      <g-message>
        ⚠️ Store temporarily unavailable

        We could not complete that action safely.
        Code: {{code}}
        Detail: {{error}}
      </g-message>
    </g-base>

    <g-base id="${Base.notFound}">
      ${this.kbk.home()}
      <g-message>
        🔎 Action not found

        Please return home and choose an action from the store menu.
      </g-message>
    </g-base>
  `
}
