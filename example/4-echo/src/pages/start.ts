import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {EchoPage} from "./echo"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: StartPage, edit = true) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([HelpPage, EchoPage], `1`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: StartPage) {
    throw ctx
  }
}

// Start page with welcome message and navigation.
export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  static template = `
    <g-base id=${Base.step1}>
      <g-keyboard>❓ Help, 🔁 Echo Tips</g-keyboard>
      <g-message>
        🔊 Echo Bot

        Send any message and I will repeat it back exactly as received. You can try text, photos, videos, documents, and more.
      </g-message>
      <g-keyboard lang="id">❓ Bantuan, 🔁 Tips Echo</g-keyboard>
      <g-message lang="id">
        🔊 Bot Echo

        Kirim pesan apa pun dan saya akan mengulanginya kembali persis seperti yang diterima. Anda dapat mencoba teks, foto, video, dokumen, dan lainnya.
      </g-message>
    </g-base>
  `
}
