import {PageBase} from "~/base/page"
import {EchoPage} from "./echo"
import {HelpPage} from "./help"

// Start page with welcome message and navigation.
export class StartPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.gdefault.show()
  }

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      await this.renderText({keyboard: this.inlineKeyboardT([HelpPage, EchoPage], `1`)})
    },
    process: () => {}
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
