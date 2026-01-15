import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Reset state and return to main menu.
export class ResetPage extends PageBase {
  static data = this.buildData({intentText: `Reset`})

  kb() {
    return this.inlineKeyboard((k, a) => {
      return k.text(a[0]!, StartPage.data.callback())
    })
  }

  async core(isEdit = false) {
    await this.cacheState.delete(`${this.userId}:category`)
    await this.cacheState.delete(`${this.userId}:page`)
    await this.sessionClear()

    const kb = this.kb()
    const bi = `reset`
    if (isEdit) {
      await this.edit(kb, {}, bi)
    } else {
      await this.reply(kb, {}, bi)
    }
  }

  async callback() {
    await this.core(true)
  }

  async text() {
    await this.core(false)
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
