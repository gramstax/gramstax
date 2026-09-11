import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

// Help page describing navigation rules.
export class StartHelpPage extends PageBase {
  static data = this.buildData({intentText: `Help`})

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  async handleText() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage])
      await this.renderAuto(kb)
    },
    process: () => {}
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
