import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Help page with usage instructions.
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
