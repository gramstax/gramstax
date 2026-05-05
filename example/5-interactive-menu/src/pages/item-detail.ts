import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {ItemListPage} from "./item-list"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: ItemDetailPage, categoryId: string, itemId: string) {
    const item = CatalogData.getItemById(categoryId, itemId)
    const getPage = await ctx.cacheState.get(`${ctx.userId}:page`)
    const page = Number(getPage ?? 0)

    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([ItemListPage.data.callbackData(`s1`, `${page}`)], `1`, bi)
    const da = {
      name: item?.name,
      description: item?.description
    }
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: ItemDetailPage) {
    throw ctx
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
    await Main.showStep1Form(this, categoryId, itemId)
  }

  static template = `
    <base id="${Base.step1}">
      <keyboard>⬅️ Back to List</keyboard>
      <message>
        📌 {~name || "Unknown"~}

        {~description || "No description found."~}
      </message>
    </base>
  `
}
