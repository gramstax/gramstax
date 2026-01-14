import {PageBase} from "~/base/page"
import {CategoryPage} from "./category"
import {HelpPage} from "./help"
import {ResetPage} from "./reset"
import {InlineWithCountPage} from "./inline-with-count"
import {InlineWithoutCountPage} from "./inline-without-count"

// Main menu page for the interactive bot.
export class StartPage extends PageBase {
  static data = this.buildData({intentText: `Menu`})

  inlineKb() {
    return this.ikb((k, a) => {
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

  bottomKb() {
    return this.bkb((k, a) => {
      return k //
        .text(a[0]!)
        .text(a[1]!)
        .row()
        .text(a[2]!)
        .text(a[3]!)
    })
  }

  async showMenu(isEdit = false) {
    const inlineKb = this.inlineKb()
    const bi = `menu`
    if (isEdit) {
      await this.edit(inlineKb, {}, bi)
      return
    }

    // First reply shows the main menu with inline buttons.
    await this.reply(inlineKb, {}, bi)

    // Second reply enables persistent quick actions.
    const kb = this.bottomKb()
    await this.reply(kb, {}, `quick-actions`)
  }

  async textCommand() {
    await this.showMenu(false)
  }

  async text() {
    await this.showMenu(false)
  }

  async callback() {
    await this.showMenu(true)
  }

  static template = `
    <base>
      <keyboard>Browse, Inline Count, Inline Simple, Help, Reset</keyboard>
      <keyboard type="bottom">${this.kbd.menu(`default`)}, ${this.kbd.browse(`default`)}, ${this.kbd.help(`default`)}, ${this.kbd.reset(`default`)}</keyboard>
      <message>
        Welcome! Choose an action from the menu.
      </message>
    </base>

    <base id="quick-actions">
      <message>
        Quick actions enabled. Use the bottom keyboard anytime.
      </message>
    </base>

    <base id="menu">
      <message>
        Main Menu

        - Browse: view categories
        - Inline Count: inline list with total pages
        - Inline Simple: inline list without totals
        - Help: learn navigation
        - Reset: clear state
      </message>
    </base>
  `
}
