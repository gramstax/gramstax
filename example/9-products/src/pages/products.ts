import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {ProductDetailPage} from "./product-detail"
import {ApiService} from "~/core/services/api"

class Base {
  static list = `list`
  static page = `page`
}

class Helper {
  static kb(ctx: ProductsPage, skip: number, hasPrev: boolean, baseId?: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, baseId)

    if (hasPrev) {
      kb.callbackData(`${skip - 5}`, `prev`)
    }
    kb.callbackData(`${skip + 5}`, `next`)

    return kb.build()
  }
}

class Main {
  static async showStep1Form(ctx: ProductsPage, skip = 0) {
    const bi = Base.list
    const hasPrev = skip > 0
    const kb = Helper.kb(ctx, skip, hasPrev, bi)

    const data = await ApiService.getProducts(skip, 5)
    const da = {
      page: `${Math.floor(skip / 5) + 1}`,
      total: Math.ceil(data.total / 5),
      count: data.products.length
    }
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: ProductsPage) {
    const arg = ctx.callbackDataArg
    const currentSkip = parseInt(ctx.temp.session?.skip as string) || 0

    if (arg === `next`) {
      const newSkip = currentSkip + 5
      ctx.temp.session = {...ctx.temp.session, skip: newSkip}
      await this.showStep1Form(ctx, newSkip)
    } else if (arg === `prev`) {
      const newSkip = Math.max(0, currentSkip - 5)
      ctx.temp.session = {...ctx.temp.session, skip: newSkip}
      await this.showStep1Form(ctx, newSkip)
    } else {
      const productId = parseInt(arg)
      if (!isNaN(productId)) {
        await ProductDetailPage.showDetail(ctx, productId)
      }
    }
  }
}

export class ProductsPage extends PageBase {
  static data = this.buildData((skip?: string) => [skip])

  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleArgsCallbackData() {
    await Main.processStep1Answer(this)
  }

  static template = `
    <base id="${Base.list}">
      ${this.kbk.back()}
      <keyboard>⬅️ Prev, Next ➡️</keyboard>
      <keyboard lang="id">⬅️ Sebelumnya, Berikutnya ➡️</keyboard>
      <message>
        📦 Products List

        Browse products from DummyJSON API.

        ─────────────
        Page {{page}} of {{total}}

        Total {{count}} products.
      </message>
      <message lang="id">
        📦 Daftar Produk

        Jelajahi produk dari API DummyJSON.

        ─────────────
        Halaman {{page}} dari {{total}}

        Total {{count}} produk.
      </message>
    </base>
  `
}