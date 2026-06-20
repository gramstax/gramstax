import {PageBase} from "~/base/page"
import {CartPage} from "./cart"
import {HelpPage} from "./help"
import {CatalogPage} from "./catalog"
import {HistoryPage} from "./history"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: StartPage, edit = false) {
    await ctx.clearSession()
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([CatalogPage.data.callbackData(Base.step1, `page`, `0`), CartPage, HistoryPage, HelpPage], `2`, bi)
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

export class StartPage extends PageBase {
  static data = this.buildData({intentText: `Home`})

  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async handleText() {
    await Main.showStep1Form(this, false)
  }

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  static template = `
    <g-base id="${Base.step1}">
      <g-keyboard>🔎 Browse Products, 🛒 Cart, 🧾 History, ❓ Help</g-keyboard>
      <g-message>
        🛒 SubStore Bot

        Buy digital subscriptions directly from Telegram. Browse Netflix, Spotify, YouTube Premium, Canva Pro, VPN access, and more with a fast inline checkout flow.

        Choose an action below to browse, checkout, or review recent orders.
      </g-message>
    </g-base>
  `
}
