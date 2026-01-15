import {PageBase} from "~/base/page"
import {CategoryPage} from "./category"
import {HelpPage} from "./help"
import {ResetPage} from "./reset"
import {InlineWithCountPage} from "./inline-with-count"
import {InlineWithoutCountPage} from "./inline-without-count"

// Main menu page for the interactive bot.
export class StartPage extends PageBase {
  static data = this.buildData({intentText: `Home`})

  ikb() {
    return this.inlineKeyboard((k, a) => {
      return k //
        .text(a[0]!, CategoryPage.data.callback())
        .text(a[1]!, InlineWithCountPage.data.callback())
        .row()
        .text(a[2]!, InlineWithoutCountPage.data.callback())
        .text(a[3]!, HelpPage.data.callback())
        .row()
        .text(a[4]!, ResetPage.data.callback())
    })
  }

  bkb() {
    return this.bottomKeyboard((k, a) => {
      return k //
        .text(a[0]!)
        .text(a[1]!)
        .row()
        .text(a[2]!)
        .text(a[3]!)
    })
  }

  async core(isEdit = false) {
    const ikb = this.ikb()
    if (isEdit) {
      await this.edit(ikb)
      return
    }

    // First reply shows the main menu with inline buttons.
    await this.reply(ikb)

    // Second reply enables persistent quick actions.
    const bkb = this.bkb()
    await this.reply(bkb, {}, `quick-actions`)
  }

  async textCommand() {
    await this.core(false)
  }

  async text() {
    await this.core(false)
  }

  async callback() {
    await this.core(true)
  }

  static template = `
    <base>
      <keyboard>Browse, Inline Count, Inline Simple, Help, Reset</keyboard>
      <keyboard type="bottom">${this.kbl.home(`default`)}, ${this.kbl.browse(`default`)}, ${this.kbl.help(`default`)}, ${this.kbl.reset(`default`)}</keyboard>
      <message>
        Main Menu

        - Browse: view categories
        - Inline Count: inline list with total pages
        - Inline Simple: inline list without totals
        - Help: learn navigation
        - Reset: clear state
      </message>
    </base>

    <base id="quick-actions">
      <message>
        Quick actions enabled. Use the bottom keyboard anytime.
      </message>
    </base>
  `
}
