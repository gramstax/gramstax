import {Env} from "~/env"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {CatalogPage} from "./catalog"

class Base {
  static step1 = `s1`
}

class Helper {
  static kb(ctx: HelpPage, bi?: string) {
    return ctx.inlineKeyboardT([CatalogPage.data.callbackData(Base.step1, `page`, `0`), StartPage], `1`, bi)
  }
}

class Main {
  static async showStep1Form(ctx: HelpPage, edit = true) {
    const bi = Base.step1
    const kb = Helper.kb(ctx, bi)
    const da = {support: Env.STORE_ADMIN_USERNAME}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: HelpPage) {
    throw ctx
  }
}

export class HelpPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  static template = `
    <base id="${Base.step1}">
      <keyboard>🔎 Browse Products, 🏠 Home</keyboard>
      <message>
        ❓ Store Help

        1. Browse products with Prev and Next.
        2. Open a product to review duration, account type, stock, and delivery time.
        3. Use ✅ Buy Now for one-item checkout or ➕ Add Cart to compare multiple products.
        4. Confirm checkout after sending your contact and notes.

        Support: {{support}}
      </message>
    </base>
  `
}
