import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {HttpRequestPage} from "./http-request"

// Main menu page for HTTP Request example.
export class StartPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.bdefault.show(false)
  }

  async handleCallbackQueryData() {
    await this.bdefault.show(true)
  }

  bdefault = {
    show: async (isEdit = true) => {
      const kb = this.inlineKeyboardT([HttpRequestPage, HelpPage], `1`)
      await this.clearSession()
      await this.renderAuto(kb, null, null, null, isEdit)
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">🌐 New Request, ❓ Help</g-keyboard>
      <g-keyboard type="inline" lang="id">🌐 Permintaan Baru, ❓ Bantuan</g-keyboard>
      <g-message>
        🌐 HTTP Request Bot

        Send any URL and I will fetch it for you. See the response status, headers, and body in real time.
      </g-message>
      <g-message lang="id">
        🌐 Bot Permintaan HTTP

        Kirim URL apa pun dan saya akan mengambilnya. Lihat status respons, header, dan isi secara langsung.
      </g-message>
    </g-base>
  `
}
