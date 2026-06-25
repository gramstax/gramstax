import {PageBase} from "~/base/page"
import {HttpRequestPage} from "./http-request"
import {HelpPage} from "./help"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: StartPage, edit: boolean) {
    await ctx.clearSession()
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([HttpRequestPage, HelpPage], `1`, bi)
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

// Main menu page for HTTP Request example.
export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  static template = `
    <g-base id="${Base.step1}">
      <g-keyboard>🌐 New Request, ❓ Help</g-keyboard>
      <g-keyboard lang="id">🌐 Permintaan Baru, ❓ Bantuan</g-keyboard>
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
