import {PageBase} from "~/base/page"
import {ProductsPage} from "./products"
import {SearchPage} from "./search"
import {CategoriesPage} from "./categories"
import {CartPage} from "./cart"

class Helper {
  static kb(ctx: StartPage) {
    return ctx.inlineKeyboard(
      (k, l) => {
        return k
          .text(l[0]!, ProductsPage.data.callbackData())
          .text(l[1]!, CategoriesPage.data.callbackData())
          .row()
          .text(l[2]!, SearchPage.data.callbackData())
          .text(l[3]!, CartPage.data.callbackData())
      },
      {cache: true}
    )
  }
}

class Main {
  static async showStep1Form(ctx: StartPage) {
    const kb = Helper.kb(ctx)
    const da = {
      firstName: ctx.userFirstName,
      time: new Date().toString()
    }
    await ctx.reply(kb, da)
  }
}

export class StartPage extends PageBase {
  static data = this.buildData((action?: string) => [action])

  async handleText() {
    await Main.showStep1Form(this)
  }

  async handleCommandText() {
    await Main.showStep1Form(this)
  }

  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <base>
      <keyboard>📦 Products, 📂 Categories, 🔍 Search, 🛒 Cart</keyboard>
      <keyboard lang="id">📦 Produk, 📂 Kategori, 🔍 Cari, 🛒 Keranjang</keyboard>
      <message>
        {{time}}

        👋 Welcome, {{firstName}}!

        Browse our product catalog powered by DummyJSON API.
        Choose a category to explore:
      </message>
      <message lang="id">
        {{time}}

        👋 Selamat datang, {{firstName}}!

        Jelajahi katalog produk kami yang menggunakan API DummyJSON.
        Pilih kategori untuk mengeksplorasi:
      </message>
    </base>
  `
}