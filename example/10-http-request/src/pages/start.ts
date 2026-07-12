import {PageBase} from "~/base/page"
import {HttpRequestPage} from "./http-request"
import {HelpPage} from "./help"

class Main {
  static async showIndex(ctx: StartPage, edit: boolean) {
    await ctx.clearSession()
    const kb = ctx.inlineKeyboardT([HttpRequestPage, HelpPage], `1`)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

// Main menu page for HTTP Request example.
export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">🌐 New Request, ❓ Help</g-keyboard>
      <g-keyboard lang="id" type="inline">🌐 Permintaan Baru, ❓ Bantuan</g-keyboard>
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
