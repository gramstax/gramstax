import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {ItemListPage} from "./item-list"

class Base {
  static detail: `detail`
}

class Perform {
  static async entryPoint(ctx: ItemDetailPage, categoryId: string, itemId: string) {
    const item = CatalogData.getItemById(categoryId, itemId)
    const page = Number((await ctx.cacheState.get(`${ctx.userId}:page`)) ?? 0)
    const kb = ctx.inlineKeyboardT([ItemListPage.data.callbackData(`page`, `${page}`)])
    const da = {
      name: item?.name,
      description: item?.description
    }
    await ctx.edit(kb, da, Base.detail)
  }

  static async delegate(ctx: ItemDetailPage) {
    const [action, categoryId, itemId] = ctx.callbackDataArgs
    if (action !== `detail` || !categoryId || !itemId) {
      return await Alert.invalidSelection()
    }

    await Perform.entryPoint(ctx, categoryId, itemId)
  }
}

class Alert {
  static async invalidSelection() {
    return null
  }
}

// Item detail page with context-aware back button.
export class ItemDetailPage extends PageBase {
  static data = this.buildData((action?: string, categoryId?: string, itemId?: string) => [action, categoryId, itemId])

  async handleArgsCallbackData() {
    await Perform.delegate(this)
  }

  static template = `
    <base>
      <keyboard>⬅️ Back to List</keyboard>
      <message>
        📌 {~name || "Unknown"~}

        {~description || "No description found."~}
      </message>
    </base>
  `
}
