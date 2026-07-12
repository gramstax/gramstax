import {PageBase} from "~/base/page"
import {CartPage} from "./cart"
import {HelpPage} from "./help"
import {CatalogPage} from "./catalog"
import {HistoryPage} from "./history"

class Main {
  static async showIndex(ctx: StartPage, edit = false) {
    await ctx.clearSession()
    const kb = ctx.inlineKeyboardT([CatalogPage, CartPage, HistoryPage, HelpPage], `2`)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

export class StartPage extends PageBase {
  static data = this.buildData({intentText: `Home`})

  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async handleText() {
    await Main.showIndex(this, false)
  }

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">🔎 Browse Products, 🛒 Cart, 🧾 History, ❓ Help</g-keyboard>
      <g-keyboard type="inline" lang="id">🔎 Jelajahi, 🛒 Keranjang, 🧾 Riwayat, ❓ Bantuan</g-keyboard>
      <g-message>
        🛒 SubStore Bot

        Buy digital subscriptions directly from Telegram. Browse Netflix, Spotify, YouTube Premium, Canva Pro, VPN access, and more with a fast inline checkout flow.

        Choose an action below to browse, checkout, or review recent orders.
      </g-message>
      <g-message lang="id">
        🛒 Bot SubStore

        Beli langganan digital langsung dari Telegram. Jelajahi Netflix, Spotify, YouTube Premium, Canva Pro, VPN, dan lainnya dengan alur checkout inline cepat.

        Pilih tindakan di bawah untuk menjelajah, checkout, atau melihat pesanan terbaru.
      </g-message>
    </g-base>
  `
}
