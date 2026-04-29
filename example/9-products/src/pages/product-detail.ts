import {PageBase} from "~/base/page"
import {ProductsPage} from "./products"
import {ApiService} from "~/core/services/api"

class Base {
  static detail = `detail`
  static error = `error`
}

class Helper {
  static kb(ctx: ProductDetailPage) {
    return ctx.inlineKeyboardT([ProductsPage], `1`, Base.detail)
  }
}

class Main {
  static async showStep1Form(ctx: ProductDetailPage, productId: number) {
    const bi = Base.detail
    const kb = Helper.kb(ctx)

    try {
      const product = await ApiService.getProduct(productId)
      const da = {
        title: product.title,
        description: product.description,
        price: product.price,
        discount: product.discountPercentage,
        rating: product.rating,
        stock: product.stock,
        brand: product.brand,
        category: product.category
      }
      await ctx.edit(kb, da, bi)
    } catch {
      await Alert.errorLoad(ctx)
    }
  }
}

class Alert {
  static async errorLoad(ctx: ProductDetailPage) {
    const bi = Base.error
    const kb = ctx.inlineKeyboardT([ProductsPage], `1`, bi)
    await ctx.edit(kb, {}, bi)
  }
}

export class ProductDetailPage extends PageBase {
  static data = this.buildData((id?: string) => [id])

  static async showDetail(ctx: PageBase, productId: number) {
    await Main.showStep1Form(ctx as ProductDetailPage, productId)
  }

  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <base id="${Base.detail}">
      ${this.kbk.back()}
      <message>
        🏷️ {{title}}

        {{description}}

        💰 Price: {{price}}
        🔥 Discount: {{discount}}%
        ⭐ Rating: {{rating}}
        📦 Stock: {{stock}}
        🏪 Brand: {{brand}}
        📂 Category: {{category}}
      </message>
      <message lang="id">
        🏷️ {{title}}

        {{description}}

        💰 Harga: {{price}}
        🔥 Diskon: {{discount}}%
        ⭐ Rating: {{rating}}
        📦 Stok: {{stock}}
        🏪 Merek: {{brand}}
        📂 Kategori: {{category}}
      </message>
    </base>

    <base id="${Base.error}">
      ${this.kbk.back()}
      <message>❌ Failed to load product details</message>
    </base>
  `
}