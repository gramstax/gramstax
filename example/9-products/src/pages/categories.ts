import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {ApiService} from "~/core/services/api"
import {CategoryProductsPage} from "./category-products"

class Base {
  static list = `list`
}

class Helper {
  static kb(ctx: CategoriesPage, categories: string[]) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, Base.list)

    for (let i = 0; i < categories.length; i += 2) {
      const cat1 = categories[i]
      const cat2 = categories[i + 1]

      if (cat1) {
        kb.callbackData(cat1, `cat:${cat1}`)
      }
      if (cat2) {
        kb.callbackData(cat2, `cat:${cat2}`)
      }
      kb.row()
    }

    return kb.build()
  }
}

class Main {
  static async showStep1Form(ctx: CategoriesPage) {
    const bi = Base.list

    try {
      const categories = await ApiService.getCategories()
      const kb = Helper.kb(ctx, categories)
      const da = {count: categories.length}
      await ctx.edit(kb, da, bi)
    } catch {
      await Alert.errorLoad(ctx)
    }
  }

  static async processStep1Answer(ctx: CategoriesPage) {
    const arg = ctx.callbackDataArg
    if (arg.startsWith(`cat:`)) {
      const category = arg.replace(`cat:`, ``)
      await CategoryProductsPage.showCategory(ctx, category)
    }
  }
}

class Alert {
  static async errorLoad(ctx: CategoriesPage) {
    const bi = Base.list
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    await ctx.edit(kb, {}, bi)
  }
}

export class CategoriesPage extends PageBase {
  static data = this.buildData((action?: string) => [action])

  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleArgsCallbackData() {
    await Main.processStep1Answer(this)
  }

  static template = `
    <base id="${Base.list}">
      ${this.kbk.back()}
      <message>
        📂 Product Categories

        Total: {{count}} categories

        Select a category to browse products.
      </message>
      <message lang="id">
        📂 Kategori Produk

        Total: {{count}} kategori

        Pilih kategori untuk melihat produk.
      </message>
    </base>
  `
}