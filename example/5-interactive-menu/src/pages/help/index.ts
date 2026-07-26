import {PageBase} from "~/base/page"
import {StartPage} from "../start"

// Help page describing navigation rules.
export class HelpPage extends PageBase {
  static data = this.buildData({intentText: `Help`})

  async handleCallbackQueryData() {
    await this.bdefault.show(true)
  }

  async handleText() {
    await this.bdefault.show(false)
  }

  bdefault = {
    show: async (isEdit = true) => {
      const kb = this.inlineKeyboardT([StartPage], `1`)
      await this.renderAuto(kb, null, null, null, isEdit)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-message>
        ❓ Help & Navigation

        Use inline buttons to explore menus, and the bottom keyboard for quick actions.
        Pagination buttons appear when lists are long.
      </g-message>
      <g-message lang="id">
        ❓ Bantuan & Navigasi

        Gunakan tombol inline untuk menjelajahi menu, dan keyboard bawah untuk aksi cepat.
        Tombol paginasi muncul ketika daftar panjang.
      </g-message>
    </g-base>
  `
}
