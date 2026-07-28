import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {EchoPage} from "./echo"

// Start page with welcome message and navigation.
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
      const kb = this.inlineKeyboardT([HelpPage, EchoPage], `1`)
      await this.renderAuto(kb, null, null, null, isEdit)
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">❓ Help, 🔁 Echo Tips</g-keyboard>
      <g-keyboard type="inline" lang="id">❓ Bantuan, 🔁 Tips Echo</g-keyboard>
      <g-message>
        🔊 Echo Bot

        Send any message and I will repeat it back exactly as received. You can try text, photos, videos, documents, and more.
      </g-message>
      <g-message lang="id">
        🔊 Bot Echo

        Kirim pesan apa pun dan saya akan mengulanginya kembali persis seperti yang diterima. Anda dapat mencoba teks, foto, video, dokumen, dan lainnya.
      </g-message>
    </g-base>
  `
}
