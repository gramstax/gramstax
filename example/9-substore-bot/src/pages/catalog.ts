import {PageBase} from "~/base/page"
import {ProductCatalog} from "~/data/store"
import {CartPage} from "./cart"
import {HelpPage} from "./help"
import {StartPage} from "./start"
import {ProductPage} from "./product"

class Helper {
  static kb(ctx: CatalogPage, page = 0) {
    const productPage = ProductCatalog.getPage(page)
    return ctx.inlineKeyboard((k, l) => {
      productPage.items.forEach((product) => {
        k.text(`${product.stockStatus === `available` ? `📦` : `⛔`} ${product.name}`, ProductPage.data.callbackData(`detail`, product.id))
        k.row()
      })

      if (productPage.hasPrev) {
        k.text(l[0]!, ctx.data.callbackData(`page`, `${productPage.page - 1}`))
      }
      if (productPage.hasNext) {
        k.text(l[1]!, ctx.data.callbackData(`page`, `${productPage.page + 1}`))
      }

      return k.row().text(l[2]!, CartPage.data.callbackData()).text(l[3]!, HelpPage.data.callbackData()).row().text(l[4]!, StartPage.data.callbackData())
    })
  }
}

class Main {
  static async showIndexForm(ctx: CatalogPage, page = 0, edit = true) {
    const productPage = ProductCatalog.getPage(page)
    await ctx.cacheState.set(`${ctx.userId}:catalogPage`, productPage.page)
    const kb = Helper.kb(ctx, productPage.page)
    const da = {
      page: productPage.page + 1,
      totalPages: productPage.totalPages,
      totalItems: productPage.totalItems,
      products: productPage.items.map((product, index) => `${index + 1}. ${product.name} — ${ProductCatalog.formatPrice(product.price)} (${ProductCatalog.stockLabel(product)})`).join(`\n`)
    }
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }

  static async processIndexForm(ctx: CatalogPage, action?: string, value?: string) {
    if (action === `page`) {
      await Main.showIndexForm(ctx, Number(value ?? 0), true)
    }
  }
}

export class CatalogPage extends PageBase {
  static data = this.buildData((action?: string, value?: string) => [action, value])

  async handleCallbackData() {
    await Main.showIndexForm(this, 0, true)
  }

  async handleArgsCallbackData() {
    const [action, value] = this.callbackDataArgs
    await Main.processIndexForm(this, action, value)
  }

  async showStep1Form(page = 0, edit = true) {
    await Main.showIndexForm(this, page, edit)
  }

  static template = `
    <g-base>
      <g-keyboard>⬅️ Prev, ➡️ Next, 🛒 Cart, ❓ Help, 🏠 Home</g-keyboard>
      <g-keyboard lang="id">⬅️ Sebelumnya, ➡️ Selanjutnya, 🛒 Keranjang, ❓ Bantuan, 🏠 Beranda</g-keyboard>
      <g-message>
        🔎 Subscription Catalog

        Page {{page}} of {{totalPages}} — {{totalItems}} products available.

        {{products}}

        Open a product to view details, buy now, or add it to your cart.
      </g-message>
      <g-message lang="id">
        🔎 Katalog Langganan

        Halaman {{page}} dari {{totalPages}} — {{totalItems}} produk tersedia.

        {{products}}

        Buka produk untuk melihat detail, beli, atau tambahkan ke keranjang.
      </g-message>
    </g-base>
  `
}
