import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Reset state and return to main menu.
export class ResetPage extends PageBase {
  static data = this.buildData({intentText: `Reset`})
  static BASE = {reset: `reset`}

  async transition(edit = false) {
    await this.cacheState.delete(`${this.userId}:category`)
    await this.cacheState.delete(`${this.userId}:page`)
    await this.clearSession()

    const kb = this.inlineKeyboardT([StartPage])
    const bi = ResetPage.BASE.reset
    if (edit) await this.edit(kb, {}, bi)
    else await this.reply(kb, {}, bi)
  }

  async handleCallbackData() {
    await this.transition(true)
  }

  async handleText() {
    await this.transition(false)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>
        ♻️ State reset

        Your navigation state has been cleared. You can start fresh from the main menu.
      </message>
    </base>

    <base id="${this.BASE.reset}">
      <message>
        ✅ Reset complete

        Tap Back to return to the main menu.
      </message>
    </base>
  `
}
