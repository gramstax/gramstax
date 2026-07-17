import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Reset state and return to main menu.
export class ResetPage extends PageBase {
  static data = this.buildData({intentText: `Reset`})

  async handleCallbackData() {
    await this.bdefault.show(true)
  }

  async handleText() {
    await this.bdefault.show(false)
  }

  bdefault = {
    show: async (isEdit = false) => {
      await this.clearSession()
      await this.cacheState.delete(`${this.userId}:category`)
      await this.cacheState.delete(`${this.userId}:page`)

      const kb = this.inlineKeyboardT([StartPage])
      if (isEdit) {
        await this.edit(kb)
      } else {
        await this.reply(kb)
      }
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-message>
        ✅ Reset complete

        Tap Back to return to the main menu.
      </g-message>
      <g-message lang="id">
        ✅ Atur ulang selesai

        Ketuk Kembali untuk kembali ke menu utama.
      </g-message>
    </g-base>
  `
}
