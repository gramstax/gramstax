import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Reset state and return to main menu.
export class ResetPage extends PageBase {
  static data = this.buildData({intentText: `Reset`})

  async show(edit = false) {
    await this.cacheState.delete(`${this.userId}:category`)
    await this.cacheState.delete(`${this.userId}:page`)
    await this.sessionClear()

    const kb = this.inlineKeyboardT([StartPage])
    const bi = `reset`
    if (edit) await this.edit(kb, {}, bi)
    else await this.reply(kb, {}, bi)
  }

  async callback() {
    await this.show(true)
  }

  async text() {
    await this.show(false)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>
        State cleared. You can start fresh.
      </message>
    </base>

    <base id="reset">
      <message>
        Reset complete. Tap Back to return.
      </message>
    </base>
  `
}
