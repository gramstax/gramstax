import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {ProductDetailPage} from "./product-detail"
import {ApiService} from "~/core/services/api"

class Base {
  static view = `view`
  static empty = `empty`
}

type CartItem = {
  id: number
  title: string
  price: number
  quantity: number
}

class Helper {
  static kb(ctx: CartPage, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }
}

class Main {
  static async showStep1Form(ctx: CartPage, bi = Base.view) {
    const kb = Helper.kb(ctx, bi)
    const items = (ctx.temp.session?.cart as CartItem[]) ?? []
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const da = {count: items.length, total}

    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: CartPage) {
    const arg = ctx.callbackDataArg
    const items = (ctx.temp.session?.cart as CartItem[]) ?? []

    if (arg.startsWith(`add:`)) {
      const productId = parseInt(arg.replace(`add:`, ``))
      try {
        const product = await ApiService.getProduct(productId)
        const existing = items.find((i) => i.id === product.id)

        if (existing) {
          existing.quantity += 1
        } else {
          items.push({id: product.id, title: product.title, price: product.price, quantity: 1})
        }

        ctx.temp.session = {...ctx.temp.session, cart: items}
        await this.showStep1Form(ctx)
      } catch {
        await Alert.errorAdd(ctx)
      }
    } else if (arg.startsWith(`remove:`)) {
      const productId = parseInt(arg.replace(`remove:`, ``))
      const index = items.findIndex((i) => i.id === productId)

      if (index !== -1) {
        const item = items[index]
        if (item && item.quantity > 1) {
          item.quantity -= 1
        } else if (item) {
          items.splice(index, 1)
        }
      }

      ctx.temp.session = {...ctx.temp.session, cart: items}
      await this.showStep1Form(ctx)
    } else if (arg === `clear`) {
      ctx.temp.session = {...ctx.temp.session, cart: []}
      await this.showStep1Form(ctx, Base.empty)
    } else {
      const productId = parseInt(arg)
      if (!isNaN(productId)) {
        await ProductDetailPage.showDetail(ctx, productId)
      }
    }
  }
}

class Alert {
  static async errorAdd(ctx: CartPage) {
    const bi = Base.view
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }
}

export class CartPage extends PageBase {
  static data = this.buildData((action?: string) => [action])

  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleArgsCallbackData() {
    await Main.processStep1Answer(this)
  }

  static template = `
    <base id="${Base.view}">
      ${this.kbk.back()}
      <keyboard>🗑️ Clear Cart</keyboard>
      <message>
        🛒 Your Cart ({{count}} items)

        Total: \${{total}}

        Use product detail to add items.
      </message>
      <message lang="id">
        🛒 Keranjang Anda ({{count}} item)

        Total: \${{total}}

        Gunakan halaman detail produk untuk menambah item.
      </message>
    </base>

    <base id="${Base.empty}">
      ${this.kbk.back()}
      <message>
        🛒 Your Cart (0 items)

        Cart is empty. Use product detail to add items.
      </message>
      <message lang="id">
        🛒 Keranjang Anda (0 item)

        Keranjang kosong. Gunakan halaman detail produk untuk menambah item.
      </message>
    </base>
  `
}