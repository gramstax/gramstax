import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndex(ctx: HelpPage, edit = true) {
    const kb = ctx.inlineKeyboardT([StartPage])
    const da = {}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

// Help page lists available commands.
export class HelpPage extends PageBase {
  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async handleCallbackData() {
    await Main.showIndex(this, true)
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
