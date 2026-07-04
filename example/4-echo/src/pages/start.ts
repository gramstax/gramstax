import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {EchoPage} from "./echo"

class Main {
  static async showIndex(ctx: StartPage, edit = true) {
    const kb = ctx.inlineKeyboardT([HelpPage, EchoPage], `1`)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

// Start page with welcome message and navigation.
export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  static template = `
    <g-base>
      <g-keyboard>❓ Help, 🔁 Echo Tips</g-keyboard>
      <g-keyboard lang="id">❓ Bantuan, 🔁 Tips Echo</g-keyboard>
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
