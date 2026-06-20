import {PageBase} from "~/base/page"
import {CartStore, type CartState, OrderStore, ProductCatalog} from "~/data/store"
import {StartPage} from "./start"
import {CatalogPage} from "./catalog"
import {CheckoutPage} from "./checkout"

class Base {
  static step1 = `s1`
  static empty = `e`
  static infoCleared = `i-cleared`
}

class Helper {
  static async getCart(ctx: CartPage): Promise<CartState> {
    return ((await ctx.cacheState.get(`${ctx.userId}:cart`)) ?? {}) as CartState
  }

  static async setCart(ctx: CartPage, cart: CartState) {
    await ctx.cacheState.set(`${ctx.userId}:cart`, cart)
  }

  static kb(ctx: CartPage, cart: CartState, bi?: string) {
    const summary = CartStore.getSummary(cart)
    return ctx.inlineKeyboard(
      (k, l) => {
        summary.items.forEach((item) => {
          k.text(`${l[0]!} ${item.product.name}`, ctx.data.callbackData(bi, `inc`, item.product.id))
          k.text(l[1]!, ctx.data.callbackData(bi, `dec`, item.product.id))
          k.text(l[2]!, ctx.data.callbackData(bi, `remove`, item.product.id))
          k.row()
        })

        if (!summary.isEmpty) {
          k.text(l[3]!, CheckoutPage.data.callbackData())
          k.text(l[4]!, ctx.data.callbackData(bi, `clear`))
          k.row()
        }

        return k.text(l[5]!, CatalogPage.data.callbackData(Base.step1, `page`, `0`)).text(l[6]!, StartPage.data.callbackData())
      },
      {baseId: bi}
    )
  }

  static kbEmpty(ctx: CartPage, bi?: string) {
    return ctx.inlineKeyboardT([CatalogPage.data.callbackData(Base.step1, `page`, `0`), StartPage], `1`, bi)
  }
}

class Main {
  static async showStep1Form(ctx: CartPage, edit = true) {
    const cart = await Helper.getCart(ctx)
    const summary = CartStore.getSummary(cart)
    const bi = summary.isEmpty ? Base.empty : Base.step1
    const kb = summary.isEmpty ? Helper.kbEmpty(ctx, bi) : Helper.kb(ctx, cart, bi)
    const da = {
      items: OrderStore.formatCart(summary),
      subtotal: ProductCatalog.formatPrice(summary.subtotal)
    }

    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: CartPage, action?: string, productId?: string) {
    const cart = await Helper.getCart(ctx)
    let next = cart

    if (action === `inc` && productId) {
      next = CartStore.addItem(cart, productId)
    } else if (action === `dec` && productId) {
      next = CartStore.decreaseItem(cart, productId)
    } else if (action === `remove` && productId) {
      next = CartStore.removeItem(cart, productId)
    } else if (action === `clear`) {
      next = CartStore.clear()
      await Helper.setCart(ctx, next)
      return await Main.showInfoCleared(ctx)
    }

    await Helper.setCart(ctx, next)
    await Main.showStep1Form(ctx, true)
  }

  static async showInfoCleared(ctx: CartPage) {
    const bi = Base.infoCleared
    const kb = Helper.kbEmpty(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }
}

export class CartPage extends PageBase {
  static data = this.buildData((step?: string, action?: string, productId?: string) => [step, action, productId])

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  async handleArgsCallbackData() {
    const [step, action, productId] = this.callbackDataArgs
    if (step === Base.step1) {
      await Main.processStep1Answer(this, action, productId)
    }
  }

  async showStep1Form(edit = true) {
    await Main.showStep1Form(this, edit)
  }

  static template = `
    <g-base id="${Base.step1}">
      <g-keyboard>➕, ➖, 🗑️ Remove, 💳 Checkout, 🧹 Clear, 🔎 Browse Products, 🏠 Home</g-keyboard>
      <g-message>
        🛒 Your Cart

        {{items}}

        Subtotal: {{subtotal}}

        Adjust quantities or continue to checkout.
      </g-message>
    </g-base>

    <g-base id="${Base.empty}">
      <g-keyboard>🔎 Browse Products, 🏠 Home</g-keyboard>
      <g-message>
        🛒 Your Cart is Empty

        Browse subscription products and add your favorites before checkout.
      </g-message>
    </g-base>

    <g-base id="${Base.infoCleared}">
      <g-keyboard>🔎 Browse Products, 🏠 Home</g-keyboard>
      <g-message>
        🧹 Cart cleared

        Your cart is empty now. You can continue browsing anytime.
      </g-message>
    </g-base>
  `
}
