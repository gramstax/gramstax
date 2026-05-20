import {PageBase} from "~/base/page"
import {ProductCatalog} from "~/data/store"
import {CartPage} from "./cart"
import {HelpPage} from "./help"
import {StartPage} from "./start"
import {ProductPage} from "./product"

class Base {
  static step1 = `s1`
}

class Helper {
  static kb(ctx: CatalogPage, page = 0) {
    const bi = Base.step1
    const productPage = ProductCatalog.getPage(page)
    return ctx.inlineKeyboard(
      (k, l) => {
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
      },
      {baseId: bi}
    )
  }
}

class Main {
  static async showStep1Form(ctx: CatalogPage, page = 0, edit = true) {
    const productPage = ProductCatalog.getPage(page)
    await ctx.cacheState.set(`${ctx.userId}:catalogPage`, productPage.page)
    const bi = Base.step1
    const kb = Helper.kb(ctx, productPage.page)
    const da = {
      page: productPage.page + 1,
      totalPages: productPage.totalPages,
      totalItems: productPage.totalItems,
      products: productPage.items.map((product, index) => `${index + 1}. ${product.name} — ${ProductCatalog.formatPrice(product.price)} (${ProductCatalog.stockLabel(product)})`).join(`\n`)
    }
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: CatalogPage, action?: string, value?: string) {
    if (action === `page`) {
      await Main.showStep1Form(ctx, Number(value ?? 0), true)
    }
  }
}

export class CatalogPage extends PageBase {
  static data = this.buildData((action?: string, value?: string) => [action, value])

  async handleCallbackData() {
    await Main.showStep1Form(this, 0, true)
  }

  async handleArgsCallbackData() {
    const [action, value] = this.callbackDataArgs
    await Main.processStep1Answer(this, action, value)
  }

  async showStep1Form(page = 0, edit = true) {
    await Main.showStep1Form(this, page, edit)
  }

  static template = `
    <base id="${Base.step1}">
      <keyboard>⬅️ Prev, ➡️ Next, 🛒 Cart, ❓ Help, 🏠 Home</keyboard>
      <message>
        🔎 Subscription Catalog

        Page {{page}} of {{totalPages}} — {{totalItems}} products available.

        {{products}}

        Open a product to view details, buy now, or add it to your cart.
      </message>
    </base>
  `
}
