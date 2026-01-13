import {PageBase} from "~/base/page"
import {CategoryPage} from "./category"
import {HelpPage} from "./help"
import {ResetPage} from "./reset"
import {InlineWithCountPage} from "./inline-with-count"
import {InlineWithoutCountPage} from "./inline-without-count"

// Main menu page for the interactive bot.
export class StartPage extends PageBase {
  static data = this.buildData()

  inlineKb() {
    return this.ikb((k, a) => {
      return k
        .text(a[0]!, CategoryPage.data.callbackData())
        .text(a[1]!, InlineWithCountPage.data.callbackData())
        .row()
        .text(a[2]!, InlineWithoutCountPage.data.callbackData())
        .text(a[3]!, HelpPage.data.callbackData())
        .row()
        .text(a[4]!, ResetPage.data.callbackData())
    })
  }

  bottomKb() {
    return this.bkb((k, a) => {
      return k
        .text(a[0]!)
        .text(a[1]!)
        .row()
        .text(a[2]!)
        .text(a[3]!)
    })
  }

  async showMenu(isEdit = false) {
    const inlineKb = this.inlineKb()

    if (isEdit) {
      await this.edit(inlineKb, {}, `menu`)
      return
    }

    // First reply shows the main menu with inline buttons.
    await this.reply(inlineKb, {}, `menu`)
    // Second reply enables persistent quick actions.
    await this.reply(this.bottomKb(), {}, `quick-actions`)
  }

  async textCommand() {
    await this.showMenu(false)
  }

  async callback() {
    await this.showMenu(true)
  }

  // Bottom keyboard uses plain text; handle actions centrally.
  async textFree() {
    const action = this.msgText.trim()
    const keyboardData = (this.constructor as typeof StartPage).kbd

    if (action === keyboardData.menu(`default`)) {
      await this.showMenu(false)
      return null
    }

    if (action === keyboardData.browse(`default`)) {
      await new CategoryPage(this).to(false)
      return null
    }

    if (action === keyboardData.help(`default`)) {
      await new HelpPage(this).to(false)
      return null
    }

    if (action === keyboardData.reset(`default`)) {
      await new ResetPage(this).to(false)
      return null
    }

    // Friendly fallback for unknown text.
    await this.reply(this.inlineKb(), {input: action}, `fallback`)
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

    <base id="fallback">
      <message>
        I did not recognize "{{input}}".
        Use the Menu, Browse, Help, or Reset buttons.
      </message>
    </base>
  `
}
