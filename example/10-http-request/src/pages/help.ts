import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Helper {
  static kb(ctx: HelpPage) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    return kb
  }
}

class Main {
  static async showStep1Form(ctx: HelpPage, edit = true) {
    const bi = Base.step1
    const kb = Helper.kb(ctx)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: HelpPage) {
    throw ctx
  }
}

// Help page with usage instructions.
export class HelpPage extends PageBase {
  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  static template = `
    <g-base id="${Base.step1}">
      ${this.kbk.back()}
      <g-message>
        ❓ Help

        This bot makes HTTP GET requests to any URL you provide.

        * How to use:
        1. Click "🌐 New Request"
        2. Send a URL (e.g., https://example.com)
        3. View the response status, headers, and body

        * Supported URL schemes: http:// and https://
        * Timeout: 15 seconds
        * Body truncated to 1500 chars

        * Commands:
        /start - Main menu
        /help - This page
      </g-message>
      <g-message lang="id">
        ❓ Bantuan

        Bot ini melakukan permintaan HTTP GET ke URL yang Anda berikan.

        * Cara menggunakan:
        1. Klik "🌐 Permintaan Baru"
        2. Kirim URL (mis. https://example.com)
        3. Lihat status respons, header, dan isi

        * Skema URL yang didukung: http:// dan https://
        * Batas waktu: 15 detik
        * Isi dipotong hingga 1500 karakter

        * Perintah:
        /start - Menu utama
        /help - Halaman ini
      </g-message>
    </g-base>
  `
}
