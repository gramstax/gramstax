import {HelpPage} from "./help"
import {PageBase} from "~/base/page"
import {ResetPage} from "./reset"
import {CategoryPage} from "./category"
import {InlineWithoutCountPage} from "./inline-without-count"

// Main menu page for the interactive bot.
export class StartPage extends PageBase {
  static data = this.buildData({intentText: `Home`})
  static BASE = {quick: `quick`}

  async show(isEdit = false) {
    const ikb = this.inlineKeyboardT([CategoryPage, InlineWithoutCountPage, InlineWithoutCountPage, HelpPage, ResetPage], `2`)
    if (isEdit) {
      return await this.edit(ikb)
    }

    // First reply shows the main menu with inline buttons.
    await this.reply(ikb)

    // Second reply enables persistent quick actions.
    const bkb = this.bottomKeyboardT(`2`)
    await this.reply(bkb, {}, StartPage.BASE.quick)
  }

  async textCommand() {
    await this.show(false)
  }

  async text() {
    await this.show(false)
  }

  async callback() {
    await this.show(true)
  }

  static template = `
    <base>
      <keyboard>🔎 Browse, 📊 Inline Count, 🧾 Inline Simple, ❓ Help, ♻️ Reset</keyboard>
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

    <base id="${this.BASE.quick}">
      <message>
        ✅ Quick actions enabled

        Use the bottom keyboard anytime to jump back to core actions.
      </message>
    </base>
  `
}
