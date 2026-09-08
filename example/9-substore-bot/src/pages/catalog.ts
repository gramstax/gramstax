import {PageBase} from "~/base/page"
import {ProductCatalog} from "~/data/store"
import {CartPage} from "./cart"
import {HelpPage} from "./help"
import {ProductPage} from "./product"
import {StartPage} from "./start"

export class CatalogPage extends PageBase {
  static data = this.buildData((action?: string, value?: string) => [action, value])

  async handleCallbackQueryData() {
    await this.gdefault.show(0)
  }

  async handleArgsCallbackQueryData() {
    const [action, value] = this.callbackQueryDataArgs
    await this.gdefault.process(action, value)
  }

  async handleCommandText() {
    await this.gdefault.show(0)
  }

  gdefault = {
    show: async (pageNo = 0) => {
      const productPage = ProductCatalog.getPage(pageNo)
      const kb = this.inlineKeyboard((k, l) => {
        productPage.items.forEach((product) => {
          k.text(`${product.stockStatus === `available` ? `📦` : `⛔`} ${product.name}`, ProductPage.data.callbackQueryData(`detail`, product.id))
          k.row()
        })

        if (productPage.hasPrev) {
          k.text(l[0]!, this.data.callbackQueryData(`page`, `${productPage.pageNo - 1}`))
        }
        if (productPage.hasNext) {
          k.text(l[1]!, this.data.callbackQueryData(`page`, `${productPage.pageNo + 1}`))
        }

        return k.row().text(l[2]!, CartPage).text(l[3]!, HelpPage).row().text(l[4]!, StartPage)
      })
      const da = {
        pageNo: productPage.pageNo + 1,
        totalPages: productPage.totalPages,
        totalItems: productPage.totalItems,
        products: productPage.items.map((product, index) => `${index + 1}. ${product.name} — ${ProductCatalog.formatPrice(product.price)} (${ProductCatalog.stockLabel(product)})`).join(`\n`)
      }

      await this.cacheState.set(`${this.from!.id}:catalogPage`, productPage.pageNo)
      await this.renderAuto(kb, da)
    },
    process: async (action?: string, value?: string) => {
      if (action === `page`) {
        await this.gdefault.show(Number(value ?? 0))
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
