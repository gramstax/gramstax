import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {ItemListPage} from "./item-list"

class Main {
  static async showIndex(ctx: ItemDetailPage, categoryId: string, itemId: string) {
    const item = CatalogData.getItemById(categoryId, itemId)
    const getPage = await ctx.cacheState.get(`${ctx.userId}:page`)
    const page = Number(getPage ?? 0)

    const kb = ctx.inlineKeyboardT([ItemListPage.data.callbackData(`${page}`)], `1`)
    const da = {
      name: item?.name,
      description: item?.description
    }
    await ctx.edit(kb, da)
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
    await Main.showIndex(this, categoryId, itemId)
  }

  static template = `
    <g-base>
      <g-keyboard>⬅️ Back to List</g-keyboard>
      <g-keyboard lang="id">⬅️ Kembali ke Daftar</g-keyboard>
      <g-message>
        📌 {~name || "Unknown"~}

        {~description || "No description found."~}
      </g-message>
      <g-message lang="id">
        📌 {~name || "Tidak dikenal"~}

        {~description || "Tidak ada deskripsi."~}
      </g-message>
    </g-base>
  `
}
