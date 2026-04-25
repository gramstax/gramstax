import {HelpPage} from "./help"
import {PageBase} from "~/base/page"
import {ResetPage} from "./reset"
import {CategoryPage} from "./category"
import {InlineWithoutCountPage} from "./inline-without-count"

class Base {
  static quick: `quick`
}

class Perform {
  static async entryPoint(ctx: StartPage, isEdit = false) {
    const ikb = ctx.inlineKeyboardT([CategoryPage, InlineWithoutCountPage, InlineWithoutCountPage, HelpPage, ResetPage], `2`)
    if (isEdit) {
      await ctx.edit(ikb)
    } else {
      await ctx.reply(ikb)

      const bkb = ctx.bottomKeyboardT(`2`)
      const da = {}
      const bi = Base.quick
      await ctx.reply(bkb, da, bi)
    }
  }
}

// Main menu page for the interactive bot.
export class StartPage extends PageBase {
  static data = this.buildData({intentText: `Home`})

  async handleCommandText() {
    await Perform.entryPoint(this, false)
  }

  async handleText() {
    await Perform.entryPoint(this, false)
  }

  async handleCallbackData() {
    await Perform.entryPoint(this, true)
  }

  static template = `
    <base>
      <keyboard type="inline">🔎 Browse, 📊 Inline Count, 🧾 Inline Simple, ❓ Help, ♻️ Reset</keyboard>
      <keyboard type="bottom">${this.kbl.home.default}, ${this.kbl.browse.default}, ${this.kbl.help.default}, ${this.kbl.reset.default}</keyboard>
      <message>
        🧭 Main Menu

        Choose how you want to explore the catalog:
        - 🔎 Browse categories and drill into items
        - 📊 Inline Count for paged lists with totals
        - 🧾 Inline Simple for quick lists without totals
        - ❓ Help for navigation tips
        - ♻️ Reset to clear stored state
      </message>
    </base>

    <base id="${Base.quick}">
      <message>
        ✅ Quick actions enabled

        Use the bottom keyboard anytime to jump back to core actions.
      </message>
    </base>
  `
}
