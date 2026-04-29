import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {ItemListPage} from "./item-list"
import {StartPage} from "./start"

class Base {
  static categories: `categories`
}

class Helper {
  static kb(ctx: CategoryPage) {
    return ctx.inlineKeyboard((k, l) => {
      CatalogData.list.forEach((category, index) => {
        k.text(category.name, ctx.data.callbackData(`category`, category.id))
        if (index % 2 === 1) {
          k.row()
        }
      })
      return k.row().text(l[0]!, StartPage.data.callbackData())
    })
  }
}

class Main {
  static async showEntryPoint(ctx: CategoryPage, edit = true) {
    const kb = Helper.kb(ctx)
    const bi = Base.categories
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processDelegate(ctx: CategoryPage) {
    const [action, categoryId] = ctx.callbackDataArgs
    if (action !== `category` || !categoryId) {
      return await Main.showEntryPoint(ctx, true)
    }

    await ctx.cacheState.set(`${ctx.userId}:category`, categoryId)
    await ctx.cacheState.set(`${ctx.userId}:page`, 0)
    await new ItemListPage(ctx).entryPoint(categoryId, 0, true)
  }
}

// Category list page with dynamic inline buttons.
export class CategoryPage extends PageBase {
  static data = this.buildData({
    callbackData: (action?: string, payload?: string) => [action, payload],
    intentText: `Browse`
  })

  async entryPoint(edit = true) {
    await Main.showEntryPoint(this, edit)
  }

  async handleCallbackData() {
    await Main.showEntryPoint(this, true)
  }

  async handleText() {
    await Main.showEntryPoint(this, false)
  }

  async handleArgsCallbackData() {
    await Main.processDelegate(this)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>
        🔎 Browse Categories

        Select a category to see its items.
      </message>
    </base>

    <base id="${Base.categories}">
      <message>
        Choose a category to continue browsing.
      </message>
    </base>
  `
}
