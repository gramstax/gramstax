import {HelpPage} from "./help"
import {PageBase} from "~/base/page"
import {ResetPage} from "./reset"
import {CategoryPage} from "./category"
import {InlineWithRangePage} from "./inline-with-range"
import {InlineWithoutRangePage} from "./inline-without-range"

class Base {
  static step1 = `s1`
  static infoQuick = `i-quick`
}

class Main {
  static async showStep1Form(ctx: StartPage, edit = false) {
    const bi = Base.step1
    const ikb = ctx.inlineKeyboardT([CategoryPage, InlineWithRangePage, InlineWithoutRangePage, HelpPage, ResetPage], `2`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(ikb, da, bi)
    } else {
      await ctx.reply(ikb, da, bi)
      await Main.showInfoQuick(ctx)
    }
  }

  static async processStep1Answer(ctx: StartPage) {
    throw ctx
  }

  static async showInfoQuick(ctx: StartPage) {
    const bi = Base.infoQuick
    const bkb = ctx.bottomKeyboardT(`2`, bi)
    const da = {}
    await ctx.reply(bkb, da, bi)
  }
}

// Main menu page for the interactive bot.
export class StartPage extends PageBase {
  static data = this.buildData({intentText: `Home`})

  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async handleText() {
    await Main.showStep1Form(this, false)
  }

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  static template = `
    <g-base id="${Base.step1}">
      <g-keyboard type="inline">🔎 Browse, 📊 Inline Range, 🧾 Inline WRange, ❓ Help, ♻️ Reset</g-keyboard>
      <g-message>
        🧭 Main Menu

        Choose how you want to explore the catalog:
        - 🔎 Browse categories and drill into items
        - 📊 Inline Count for paged lists with totals
        - 🧾 Inline Simple for quick lists without totals
        - ❓ Help for navigation tips
        - ♻️ Reset to clear stored state
      </g-message>
    </g-base>
    <g-base id="${Base.infoQuick}">
      <g-keyboard type="bottom">${this.kbl.home.default}, ${this.kbl.browse.default}, ${this.kbl.help.default}, ${this.kbl.reset.default}</g-keyboard>
      <g-message>
        ✅ Quick actions enabled

        Use the bottom keyboard anytime to jump back to core actions.
      </g-message>
    </g-base>
  `
}
