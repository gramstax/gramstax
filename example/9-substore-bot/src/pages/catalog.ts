import {PageBase} from "~/base/page"
import {ProductCatalog} from "~/data/store"
import {CartPage} from "./cart"
import {HelpPage} from "./help"
import {StartPage} from "./start"
import {ProductPage} from "./product"

export class CatalogPage extends PageBase {
  static data = this.buildData((action?: string, value?: string) => [action, value])

  async handleCallbackData() {
    await this.bdefault.show(0, true)
  }

  async handleArgsCallbackData() {
    const [action, value] = this.callbackDataArgs
    await this.bdefault.process(action, value)
  }

  async handleCommandText() {
    await this.bdefault.show(0, false)
  }

  bdefault = {
    show: async (pageNo = 0, isEdit = true) => {
      const productPage = ProductCatalog.getPage(pageNo)
      const kb = this.inlineKeyboard((k, l) => {
        productPage.items.forEach((product) => {
          k.text(`${product.stockStatus === `available` ? `📦` : `⛔`} ${product.name}`, ProductPage.data.callbackData(`detail`, product.id))
          k.row()
        })

        if (productPage.hasPrev) {
          k.text(l[0]!, this.data.callbackData(`page`, `${productPage.pageNo - 1}`))
        }
        if (productPage.hasNext) {
          k.text(l[1]!, this.data.callbackData(`page`, `${productPage.pageNo + 1}`))
        }

        return k.row().text(l[2]!, CartPage.data.callbackData()).text(l[3]!, HelpPage.data.callbackData()).row().text(l[4]!, StartPage.data.callbackData())
      })
      const da = {
        pageNo: productPage.pageNo + 1,
        totalPages: productPage.totalPages,
        totalItems: productPage.totalItems,
        products: productPage.items.map((product, index) => `${index + 1}. ${product.name} — ${ProductCatalog.formatPrice(product.price)} (${ProductCatalog.stockLabel(product)})`).join(`\n`)
      }

      await this.cacheState.set(`${this.userId}:catalogPage`, productPage.pageNo)
      if (isEdit) {
        await this.edit(kb, da)
      } else {
        await this.reply(kb, da)
      }
    },
    process: async (action?: string, value?: string) => {
      if (action === `page`) {
        await this.bdefault.show(Number(value ?? 0), true)
      }
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">⬅️ Prev, ➡️ Next, 🛒 Cart, ❓ Help, 🏠 Home</g-keyboard>
      <g-keyboard type="inline" lang="id">⬅️ Sebelumnya, ➡️ Selanjutnya, 🛒 Keranjang, ❓ Bantuan, 🏠 Beranda</g-keyboard>
      <g-message>
        🔎 Subscription Catalog

        Page {{pageNo}} of {{totalPages}} — {{totalItems}} products available.

        {{products}}

        Open a product to view details, buy now, or add it to your cart.
      </g-message>
      <g-message lang="id">
        🔎 Katalog Langganan

        Halaman {{pageNo}} dari {{totalPages}} — {{totalItems}} produk tersedia.

        {{products}}

        Buka produk untuk melihat detail, beli, atau tambahkan ke keranjang.
      </g-message>
    </g-base>
  `
}
