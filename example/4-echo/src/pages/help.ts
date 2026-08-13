import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Help page lists available commands.
export class HelpPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.bdefault.show()
  }

  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage])
      await this.renderAuto(kb)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-message>
        ❓ Help

        Available commands:
        - /start: Welcome message
        - /help: Show this help

        You can also send any message to echo it back.
      </g-message>
      <g-message lang="id">
        ❓ Bantuan

        Perintah yang tersedia:
        - /start: Pesan selamat datang
        - /help: Tampilkan bantuan ini

        Anda juga dapat mengirim pesan apa pun untuk melihat gema.
      </g-message>
    </g-base>
  `
}
