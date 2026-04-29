import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {ItemListPage} from "./item-list"

class Base {
  static detail: `detail`
}

class Main {
  static async showEntryPoint(ctx: ItemDetailPage, categoryId: string, itemId: string) {
    const item = CatalogData.getItemById(categoryId, itemId)
    const page = Number((await ctx.cacheState.get(`${ctx.userId}:page`)) ?? 0)
    const kb = ctx.inlineKeyboardT([ItemListPage.data.callbackData(`page`, `${page}`)])
    const da = {
      name: item?.name,
      description: item?.description
    }
    await ctx.edit(kb, da, Base.detail)
  }

  static async processDelegate(ctx: ItemDetailPage, categoryId: string, itemId: string) {
    await Main.showEntryPoint(ctx, categoryId, itemId)
  }
}

// Item detail page with context-aware back button.
export class ItemDetailPage extends PageBase {
  static data = this.buildData((action?: string, categoryId?: string, itemId?: string) => [action, categoryId, itemId])

  async handleArgsCallbackData() {
    const [action, categoryId, itemId] = this.callbackDataArgs
    if (action !== `detail` || !categoryId || !itemId) {
      return
    }
    await Main.processDelegate(this, categoryId, itemId)
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
