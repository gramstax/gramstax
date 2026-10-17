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

  helper = {}
  gdefault = {
    show: async () => {
      await this.clearSession()
      const id = this.from!.id
      await this.cacheState.delete(`${id}:category`)
      await this.cacheState.delete(`${id}:page`)

      await this.renderText({keyboard: this.inlineKeyboardT([StartPage])})
    },
    process: () => {}
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
