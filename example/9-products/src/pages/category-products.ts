import {PageBase} from "~/base/page"
import {CategoriesPage} from "./categories"
import {ProductDetailPage} from "./product-detail"
import {ApiService} from "~/core/services/api"

class Base {
  static list = `list`
  static error = `error`
}

class Helper {
  static kb(ctx: CategoryProductsPage, skip: number, hasPrev: boolean, category: string, baseId?: string) {
    const kb = ctx.inlineKeyboardT([CategoriesPage], `1`, baseId)

    if (hasPrev) {
      kb.callbackData(`${skip - 5}:${category}`, `prev:${skip - 5}`)
    }
    kb.callbackData(`${skip + 5}:${category}`, `next:${skip + 5}`)

    return kb.build()
  }
}

class Main {
  static async showStep1Form(ctx: CategoryProductsPage, category: string, skip = 0) {
    const hasPrev = skip > 0

    try {
      const bi = Base.list
      const kb = Helper.kb(ctx, skip, hasPrev, category, bi)
      const data = await ApiService.getProductsByCategory(category, skip, 5)
      const da = {category, count: data.products.length}
      ctx.temp.session = {...ctx.temp.session, category, skip}
      await ctx.edit(kb, da, bi)
    } catch {
      const bi = Base.error
      const kb = Helper.kb(ctx, skip, hasPrev, category, bi)
      const da = {category}
      await ctx.edit(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: CategoryProductsPage) {
    const arg = ctx.callbackDataArg
    const session = ctx.temp.session as {category?: string; skip?: number}
    const category = session?.category ?? ``

    if (arg.startsWith(`prev:`) || arg.startsWith(`next:`)) {
      const parts = arg.split(`:`)
      const newSkip = parseInt(parts[1])
      await this.showStep1Form(ctx, category, newSkip)
    } else {
      const productId = parseInt(arg)
      if (!isNaN(productId)) {
        await ProductDetailPage.showDetail(ctx, productId)
      }
    }
  }
}

export class CategoryProductsPage extends PageBase {
  static data = this.buildData((cat?: string, skip?: string) => [cat, skip])

  static async showCategory(ctx: PageBase, category: string) {
    await Main.showStep1Form(ctx as CategoryProductsPage, category)
  }

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
        📂 Category: {{category}}

        {{count}} products in this category.

        Powered by DummyJSON API.
      </message>
      <message lang="id">
        📂 Kategori: {{category}}

        {{count}} produk dalam kategori ini.

        Menggunakan API DummyJSON.
      </message>
    </base>

    <base id="${Base.error}">
      ${this.kbk.back()}
      <message>
        📂 Category: {{category}}

        Failed to load products.
      </message>
    </base>
  `
}
