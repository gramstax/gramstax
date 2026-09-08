import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

// Reset state and return to main menu.
export class StartResetPage extends PageBase {
  static data = this.buildData({intentText: `Reset`})

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  async handleText() {
    await this.gdefault.show()
  }

  gdefault = {
    show: async () => {
      await this.clearSession()
      await this.cacheState.delete(`${this.from!.id}:category`)
      await this.cacheState.delete(`${this.from!.id}:page`)

      const kb = this.inlineKeyboardT([StartPage])
      await this.renderAuto(kb)
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
